use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env,
    MessageInfo, Response, StdResult,
};
use crate::error::ContractError;
use crate::fees::{self, MIN_BET};
use crate::msg::{ExecuteMsg, InstantiateMsg, MatchResponse, MigrateMsg, QueryMsg};
use crate::state::{Config, Match, MatchStatus, CONFIG, MATCHES};

// Active matches can be refunded by game_server after 10 minutes of no settlement.
const ACTIVE_REFUND_TIMEOUT_SECS: u64 = 600;
// Pending matches (no opponent joined) can be refunded after 2 minutes.
const PENDING_REFUND_TIMEOUT_SECS: u64 = 120;

#[entry_point]
pub fn instantiate(deps: DepsMut, _env: Env, _info: MessageInfo, msg: InstantiateMsg) -> StdResult<Response> {
    CONFIG.save(deps.storage, &Config {
        game_server: deps.api.addr_validate(&msg.game_server)?,
        allowed_denoms: msg.allowed_denoms,
    })?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new().add_attribute("action", "migrate"))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CreateMatch { match_id, opponent } => create_match(deps, env, info, match_id, opponent),
        ExecuteMsg::AcceptMatch { match_id }           => accept_match(deps, env, info, match_id),
        ExecuteMsg::SettleMatch { match_id, winner }   => settle_match(deps, info, match_id, winner),
        ExecuteMsg::RefundMatch { match_id }           => refund_match(deps, env, info, match_id),
        ExecuteMsg::CancelMatch { match_id }           => cancel_match(deps, info, match_id),
        ExecuteMsg::AbortMatch { match_id }            => abort_match(deps, info, match_id),
        ExecuteMsg::UpdateConfig { game_server, allowed_denoms } => update_config(deps, info, game_server, allowed_denoms),
        ExecuteMsg::WithdrawFees { denom, recipient }  => withdraw_fees(deps, env, info, denom, recipient),
    }
}

fn create_match(deps: DepsMut, env: Env, info: MessageInfo, match_id: String, opponent: Option<String>) -> Result<Response, ContractError> {
    if match_id.len() > 64 { return Err(ContractError::InvalidMatchId); }
    if MATCHES.has(deps.storage, &match_id) { return Err(ContractError::MatchAlreadyExists); }
    if info.funds.len() != 1 {
        return Err(ContractError::InvalidFunds { msg: "exactly one coin required".to_string() });
    }
    let coin = info.funds.first().ok_or(ContractError::WrongFunds)?;
    if coin.amount < MIN_BET { return Err(ContractError::BetTooSmall); }
    let config = CONFIG.load(deps.storage)?;
    if !config.allowed_denoms.is_empty() && !config.allowed_denoms.contains(&coin.denom) {
        return Err(ContractError::InvalidDenom);
    }
    let opponent_addr = opponent.map(|o| deps.api.addr_validate(&o)).transpose()?;
    MATCHES.save(deps.storage, &match_id, &Match {
        match_id: match_id.clone(),
        challenger: info.sender.clone(),
        opponent: opponent_addr,
        amount: coin.amount,
        denom: coin.denom.clone(),
        status: MatchStatus::Pending,
        winner: None,
        created_at: env.block.time.seconds(),
        activated_at: None,
    })?;
    Ok(Response::new()
        .add_attribute("action", "create_match")
        .add_attribute("match_id", match_id)
        .add_attribute("challenger", info.sender)
        .add_attribute("amount", coin.amount)
        .add_attribute("denom", &coin.denom))
}

fn accept_match(deps: DepsMut, env: Env, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if m.status != MatchStatus::Pending { return Err(ContractError::InvalidState); }
    match &m.opponent {
        Some(addr) => {
            if *addr != info.sender { return Err(ContractError::Unauthorized); }
        }
        None => {
            // Public match — challenger cannot accept their own match
            if info.sender == m.challenger { return Err(ContractError::Unauthorized); }
            m.opponent = Some(info.sender.clone());
        }
    }
    if info.funds.len() != 1 {
        return Err(ContractError::InvalidFunds { msg: "exactly one coin required".to_string() });
    }
    let coin = info.funds.first().ok_or(ContractError::WrongFunds)?;
    if coin.amount != m.amount || coin.denom != m.denom { return Err(ContractError::WrongFunds); }
    m.status = MatchStatus::Active;
    m.activated_at = Some(env.block.time.seconds());
    MATCHES.save(deps.storage, &match_id, &m)?;
    Ok(Response::new()
        .add_attribute("action", "accept_match")
        .add_attribute("match_id", match_id)
        .add_attribute("opponent", info.sender))
}

fn settle_match(deps: DepsMut, info: MessageInfo, match_id: String, winner: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if m.status != MatchStatus::Active { return Err(ContractError::InvalidState); }
    let winner_addr = deps.api.addr_validate(&winner)?;
    // Winner must be a verified match participant — prevents fund theft via spoofed address
    let is_participant = winner_addr == m.challenger
        || m.opponent.as_ref().map_or(false, |o| winner_addr == *o);
    if !is_participant { return Err(ContractError::Unauthorized); }
    m.status = MatchStatus::Complete;
    m.winner = Some(winner_addr.clone());
    MATCHES.save(deps.storage, &match_id, &m)?;
    let payout = fees::compute_payout(m.amount)?;
    let send = BankMsg::Send {
        to_address: winner_addr.to_string(),
        amount: vec![Coin { denom: m.denom, amount: payout }],
    };
    Ok(Response::new()
        .add_message(send)
        .add_attribute("action", "settle_match")
        .add_attribute("match_id", match_id)
        .add_attribute("winner", winner)
        .add_attribute("payout", payout))
}

fn refund_match(deps: DepsMut, env: Env, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    let now = env.block.time.seconds();
    let was_active = m.status == MatchStatus::Active;

    let can_refund = if was_active {
        // Active refund: only game_server, timeout from activated_at
        if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
        let activated = m.activated_at.unwrap_or(m.created_at);
        now.saturating_sub(activated) > ACTIVE_REFUND_TIMEOUT_SECS
    } else if m.status == MatchStatus::Pending {
        // Pending refund: challenger or game_server, timeout from created_at
        let caller_ok = info.sender == m.challenger || info.sender == config.game_server;
        if !caller_ok { return Err(ContractError::Unauthorized); }
        now.saturating_sub(m.created_at) > PENDING_REFUND_TIMEOUT_SECS
    } else {
        false
    };

    if !can_refund { return Err(ContractError::InvalidState); }
    m.status = MatchStatus::Refunded;
    MATCHES.save(deps.storage, &match_id, &m)?;
    let mut msgs = vec![BankMsg::Send {
        to_address: m.challenger.to_string(),
        amount: vec![Coin { denom: m.denom.clone(), amount: m.amount }],
    }];
    // Only refund opponent if they already deposited (Active state)
    if was_active {
        if let Some(opponent) = m.opponent {
            msgs.push(BankMsg::Send {
                to_address: opponent.to_string(),
                amount: vec![Coin { denom: m.denom, amount: m.amount }],
            });
        }
    }
    Ok(Response::new().add_messages(msgs).add_attribute("action", "refund_match").add_attribute("match_id", match_id))
}

// Creator-initiated cancel: callable by game_server OR the challenger themselves (Pending only).
fn cancel_match(deps: DepsMut, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if info.sender != config.game_server && info.sender != m.challenger {
        return Err(ContractError::Unauthorized);
    }
    if m.status != MatchStatus::Pending { return Err(ContractError::InvalidState); }
    m.status = MatchStatus::Cancelled;
    MATCHES.save(deps.storage, &match_id, &m)?;
    let msgs = vec![BankMsg::Send {
        to_address: m.challenger.to_string(),
        amount: vec![Coin { denom: m.denom, amount: m.amount }],
    }];
    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "cancel_match")
        .add_attribute("match_id", match_id)
        .add_attribute("refund", m.amount.to_string()))
}

// Game-server-initiated abort: refunds both players from Active state.
// Used when a player disconnects before the game starts.
fn abort_match(deps: DepsMut, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if m.status != MatchStatus::Active { return Err(ContractError::InvalidState); }
    // Validate opponent exists BEFORE writing state — avoids partial write on error
    let opponent = m.opponent.clone().ok_or(ContractError::InvalidState)?;
    m.status = MatchStatus::Refunded;
    MATCHES.save(deps.storage, &match_id, &m)?;
    let (challenger_share, opponent_share) = fees::compute_abort_payout(m.amount)?;
    let msgs = vec![
        BankMsg::Send { to_address: m.challenger.to_string(), amount: vec![Coin { denom: m.denom.clone(), amount: challenger_share }] },
        BankMsg::Send { to_address: opponent.to_string(), amount: vec![Coin { denom: m.denom, amount: opponent_share }] },
    ];
    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "abort_match")
        .add_attribute("match_id", match_id))
}

fn update_config(deps: DepsMut, info: MessageInfo, game_server: Option<String>, allowed_denoms: Option<Vec<String>>) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
    if let Some(gs) = game_server {
        config.game_server = deps.api.addr_validate(&gs)?;
    }
    if let Some(denoms) = allowed_denoms {
        config.allowed_denoms = denoms;
    }
    CONFIG.save(deps.storage, &config)?;
    Ok(Response::new().add_attribute("action", "update_config"))
}

fn withdraw_fees(deps: DepsMut, env: Env, info: MessageInfo, denom: String, recipient: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
    let recipient_addr = deps.api.addr_validate(&recipient)?;
    let balance = deps.querier.query_balance(env.contract.address, &denom)?;
    if balance.amount.is_zero() { return Err(ContractError::InvalidState); }
    let send = BankMsg::Send {
        to_address: recipient_addr.to_string(),
        amount: vec![balance.clone()],
    };
    Ok(Response::new()
        .add_message(send)
        .add_attribute("action", "withdraw_fees")
        .add_attribute("amount", balance.amount)
        .add_attribute("denom", denom)
        .add_attribute("recipient", recipient))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Match { match_id } => {
            let m = MATCHES.load(deps.storage, &match_id)?;
            to_json_binary(&MatchResponse {
                match_id: m.match_id,
                challenger: m.challenger,
                opponent: m.opponent,
                amount: m.amount.to_string(),
                denom: m.denom,
                status: m.status,
                winner: m.winner,
                activated_at: m.activated_at,
            })
        }
    }
}
