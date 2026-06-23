use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};

#[cw_serde]
pub struct Config {
    pub game_server: Addr,
    /// Accepted bet denoms. Empty = any denom allowed (dev/test only).
    pub allowed_denoms: Vec<String>,
}

#[cw_serde]
#[derive(Eq)]
pub enum MatchStatus {
    Pending,
    Active,
    Complete,
    Refunded,
    Cancelled,
}

#[cw_serde]
pub struct Match {
    pub match_id: String,
    pub challenger: Addr,
    pub opponent: Option<Addr>,
    pub amount: Uint128,
    pub denom: String,
    pub status: MatchStatus,
    pub winner: Option<Addr>,
    pub created_at: u64,
    /// Set when AcceptMatch is called — used for Active refund timeout.
    pub activated_at: Option<u64>,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const MATCHES: Map<&str, Match> = Map::new("matches");
