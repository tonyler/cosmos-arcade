use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Match not found")]
    MatchNotFound,
    #[error("Match already exists")]
    MatchAlreadyExists,
    #[error("Invalid state")]
    InvalidState,
    #[error("Wrong funds")]
    WrongFunds,
    #[error("Invalid funds: {msg}")]
    InvalidFunds { msg: String },
    #[error("Bet too small — minimum is 50000 uatom")]
    BetTooSmall,
    #[error("Insufficient pot after gas deduction")]
    InsufficientPot,
}
