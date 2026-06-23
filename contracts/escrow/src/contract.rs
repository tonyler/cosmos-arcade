use cosmwasm_std::{
    entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env,
    MessageInfo, Response, StdResult, Uint128,
};
use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, MatchResponse, QueryMsg};
use crate::state::{Config, Match, MatchStatus, CONFIG, MATCHES};

#[entry_point]
pub fn instantiate(deps: DepsMut, _env: Env, _info: MessageInfo, msg: InstantiateMsg) -> StdResult<Response> {
    CONFIG.save(deps.storage, &Config {
        game_server: deps.api.addr_validate(&msg.game_server)?,
    })?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CreateMatch { match_id, opponent } => create_match(deps, env, info, match_id, opponent),
        ExecuteMsg::AcceptMatch { match_id } => accept_match(deps, info, match_id),
        ExecuteMsg::SettleMatch { match_id, winner } => settle_match(deps, info, match_id, winner),
        ExecuteMsg::RefundMatch { match_id } => refund_match(deps, env, info, match_id),
        ExecuteMsg::CancelMatch { match_id } => cancel_match(deps, info, match_id),
        ExecuteMsg::AbortMatch { match_id } => abort_match(deps, info, match_id),
    }
}

fn create_match(deps: DepsMut, env: Env, info: MessageInfo, match_id: String, opponent: Option<String>) -> Result<Response, ContractError> {
    if MATCHES.has(deps.storage, &match_id) { return Err(ContractError::MatchAlreadyExists); }
    if info.funds.len() != 1 {
        return Err(ContractError::InvalidFunds { msg: "exactly one coin required".to_string() });
    }
    let coin = info.funds.first().ok_or(ContractError::WrongFunds)?;
    let opponent_addr = opponent.map(|o| deps.api.addr_validate(&o)).transpose()?;
    MATCHES.save(deps.storage, &match_id, &Match {
        match_id: match_id.clone(),
        challenger: info.sender,
        opponent: opponent_addr,
        amount: coin.amount,
        denom: coin.denom.clone(),
        status: MatchStatus::Pending,
        winner: None,
        created_at: env.block.time.seconds(),
    })?;
    Ok(Response::new().add_attribute("action", "create_match").add_attribute("match_id", match_id))
}

fn accept_match(deps: DepsMut, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if m.status != MatchStatus::Pending { return Err(ContractError::InvalidState); }
    match &m.opponent {
        Some(addr) => { if *addr != info.sender { return Err(ContractError::Unauthorized); } }
        None => { m.opponent = Some(info.sender.clone()); } // public match — first joiner claims the slot
    }
    if info.funds.len() != 1 {
        return Err(ContractError::InvalidFunds { msg: "exactly one coin required".to_string() });
    }
    let coin = info.funds.first().ok_or(ContractError::WrongFunds)?;
    if coin.amount != m.amount || coin.denom != m.denom { return Err(ContractError::WrongFunds); }
    m.status = MatchStatus::Active;
    MATCHES.save(deps.storage, &match_id, &m)?;
    Ok(Response::new().add_attribute("action", "accept_match"))
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
    let payout = m.amount.checked_mul(Uint128::new(2)).unwrap();
    let send = BankMsg::Send { to_address: winner_addr.to_string(), amount: vec![Coin { denom: m.denom, amount: payout }] };
    Ok(Response::new().add_message(send).add_attribute("action", "settle_match").add_attribute("winner", winner))
}

fn refund_match(deps: DepsMut, env: Env, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    let elapsed = env.block.time.seconds() - m.created_at;
    let was_active = m.status == MatchStatus::Active;
    let can_refund = (m.status == MatchStatus::Pending && elapsed > 120)
        || (was_active && elapsed > 60);
    if !can_refund { return Err(ContractError::InvalidState); }
    let caller_is_participant = info.sender == m.challenger
        || m.opponent.as_ref().map_or(false, |o| *o == info.sender);
    if !caller_is_participant { return Err(ContractError::Unauthorized); }
    m.status = MatchStatus::Refunded;
    MATCHES.save(deps.storage, &match_id, &m)?;
    let mut msgs = vec![BankMsg::Send {
        to_address: m.challenger.to_string(),
        amount: vec![Coin { denom: m.denom.clone(), amount: m.amount }],
    }];
    // only refund opponent if they already deposited (Active state)
    if was_active {
        if let Some(opponent) = m.opponent {
            msgs.push(BankMsg::Send {
                to_address: opponent.to_string(),
                amount: vec![Coin { denom: m.denom, amount: m.amount }],
            });
        }
    }
    Ok(Response::new().add_messages(msgs).add_attribute("action", "refund_match"))
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
    Ok(Response::new().add_messages(msgs)
        .add_attribute("action", "cancel_match")
        .add_attribute("match_id", match_id)
        .add_attribute("refund", m.amount.to_string()))
}

// Game-server-initiated abort: refunds both players immediately from Active state.
// Used when a player quits before the game starts (pre-ready abort).
fn abort_match(deps: DepsMut, info: MessageInfo, match_id: String) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    if info.sender != config.game_server { return Err(ContractError::Unauthorized); }
    let mut m = MATCHES.load(deps.storage, &match_id).map_err(|_| ContractError::MatchNotFound)?;
    if m.status != MatchStatus::Active { return Err(ContractError::InvalidState); }
    // Validate opponent exists BEFORE writing state — avoids partial write on error
    let opponent = m.opponent.clone().ok_or(ContractError::InvalidState)?;
    m.status = MatchStatus::Refunded;
    MATCHES.save(deps.storage, &match_id, &m)?;
    let msgs = vec![
        BankMsg::Send { to_address: m.challenger.to_string(), amount: vec![Coin { denom: m.denom.clone(), amount: m.amount }] },
        BankMsg::Send { to_address: opponent.to_string(), amount: vec![Coin { denom: m.denom, amount: m.amount }] },
    ];
    Ok(Response::new().add_messages(msgs)
        .add_attribute("action", "abort_match")
        .add_attribute("match_id", match_id))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Match { match_id } => {
            let m = MATCHES.load(deps.storage, &match_id)?;
            to_json_binary(&MatchResponse {
                match_id: m.match_id,
                challenger: m.challenger,
                opponent: m.opponent,  // Option<Addr>
                amount: m.amount.to_string(),
                denom: m.denom,
                status: format!("{:?}", m.status),
                winner: m.winner,
            })
        }
    }
}
