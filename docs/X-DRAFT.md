Veil brings private receiving to NEAR named accounts. Built at NEAR HACKATHON with @NEARProtocol #NEARHackathon.

`ada.near` stays readable, but each payment lands at a fresh Ed25519 implicit account. The sender announces only an ephemeral public key and a view tag. Alice scans with her viewing key, finds the payments, and spends with her separate spending key.

Why NEAR: named accounts create a privacy leak, while implicit accounts make one-time destinations possible without a protocol change.

Testnet proof: 3 private sends, scan finds 3, 1 stealth spend, plus a Sputnik DAO FunctionCall payout discovered by the recipient scanner. Amounts, timing, senders, and later sweeping remain public. #NEAR #Privacy
