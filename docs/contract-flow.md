# Escrow Contract Flow

```
Player A: ExecuteMsg::CreateMatch { match_id, opponent } + funds
Player B: ExecuteMsg::AcceptMatch { match_id } + same funds
   (game plays out offchain)
Server:   ExecuteMsg::SettleMatch { match_id, winner }
Contract: BankMsg::Send winner 2x funds
```

Timeout path: anyone calls `RefundMatch` after 5min (pending) or 10min (active).
Server wallet address must equal `game_server` set at instantiate.
