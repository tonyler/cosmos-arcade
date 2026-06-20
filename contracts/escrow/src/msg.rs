use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

#[cw_serde]
pub struct InstantiateMsg {
    pub game_server: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    CreateMatch { match_id: String, opponent: Option<String> },
    AcceptMatch { match_id: String },
    SettleMatch { match_id: String, winner: String },
    RefundMatch { match_id: String },
    CancelMatch { match_id: String },
    AbortMatch { match_id: String },
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
    pub status: String,
    pub winner: Option<Addr>,
}
