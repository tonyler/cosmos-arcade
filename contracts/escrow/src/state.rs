use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub game_server: Addr,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum MatchStatus {
    Pending,
    Active,
    Complete,
    Refunded,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Match {
    pub match_id: String,
    pub challenger: Addr,
    pub opponent: Option<Addr>,
    pub amount: Uint128,
    pub denom: String,
    pub status: MatchStatus,
    pub winner: Option<Addr>,
    pub created_at: u64,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const MATCHES: Map<&str, Match> = Map::new("matches");
