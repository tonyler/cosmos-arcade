use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;
use crate::state::MatchStatus;

#[cw_serde]
pub struct InstantiateMsg {
    pub game_server: String,
    /// Accepted bet denoms (e.g. ["uatom"]). Empty = any denom allowed.
    pub allowed_denoms: Vec<String>,
}

#[cw_serde]
pub struct MigrateMsg {}

#[cw_serde]
pub enum ExecuteMsg {
    CreateMatch { match_id: String, opponent: Option<String> },
    AcceptMatch { match_id: String },
    SettleMatch { match_id: String, winner: String },
    RefundMatch { match_id: String },
    CancelMatch { match_id: String },
    AbortMatch { match_id: String },
    /// game_server only — rotate server key or update allowed denoms.
    UpdateConfig { game_server: Option<String>, allowed_denoms: Option<Vec<String>> },
    /// game_server only — sweep accumulated gas reserves to recipient.
    WithdrawFees { denom: String, recipient: String },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(MatchResponse)]
    Match { match_id: String },
}

#[cw_serde]
pub struct MatchResponse {
    pub match_id: String,
    pub challenger: Addr,
    pub opponent: Option<Addr>,
    pub amount: String,
    pub denom: String,
    pub status: MatchStatus,
    pub winner: Option<Addr>,
    pub activated_at: Option<u64>,
}
