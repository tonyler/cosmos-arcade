use cosmwasm_std::Uint128;
use crate::error::ContractError;

pub const MIN_BET: Uint128 = Uint128::new(50_000); // 0.05 ATOM in uatom

// Gas reserves deducted from pot — stay in contract, swept periodically to treasury.
// Based on Cosmos Hub ~0.025 uatom/gas with generous buffer.
const SETTLE_GAS_RESERVE: Uint128 = Uint128::new(5_000);  // ~80k gas for single BankMsg::Send
const ABORT_GAS_RESERVE: Uint128 = Uint128::new(8_000);   // ~160k gas for two BankMsg::Send

/// Winner payout: total pot minus gas reserve.
pub fn compute_payout(amount: Uint128) -> Result<Uint128, ContractError> {
    let pot = amount.checked_mul(Uint128::new(2)).map_err(|_| ContractError::InsufficientPot)?;
    pot.checked_sub(SETTLE_GAS_RESERVE).map_err(|_| ContractError::InsufficientPot)
}

/// Abort payout: pot minus gas reserve, split equally. Returns (challenger_share, opponent_share).
/// Dust from integer division stays in contract.
pub fn compute_abort_payout(amount: Uint128) -> Result<(Uint128, Uint128), ContractError> {
    let pot = amount.checked_mul(Uint128::new(2)).map_err(|_| ContractError::InsufficientPot)?;
    let remainder = pot.checked_sub(ABORT_GAS_RESERVE).map_err(|_| ContractError::InsufficientPot)?;
    let each = remainder.checked_div(Uint128::new(2)).map_err(|_| ContractError::InsufficientPot)?;
    Ok((each, each))
}
