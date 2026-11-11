Add-Type -AssemblyName System.Speech
$text = @'
Veil brings private receiving to NEAR named accounts. This recording uses the testnet application build and live testnet data.

A normal named account makes every payment easy to connect to its owner. Veil lets a recipient register a spending key and a viewing key, while senders derive a fresh Ed25519 implicit account for every payment.

Here we resolve Alice's registered testnet name through the Veil registry. The public identity remains readable, but the payment destinations are one-time accounts. The router stores only the announcement metadata needed for scanning: an ephemeral public key and a view tag.

The private keys stay in the wallet and browser memory. They are never sent to a server. An owner scans announcements with the view key, uses the view tag to skip unrelated payments, and derives the spend key only for matching outputs. An auditor can receive a view key and inspect incoming payments without being able to spend.

The fresh testnet evidence records Alice registering, three senders paying three different stealth accounts, the scan finding all three, and one stealth account spending back to a sender. The verified DAO evidence also records a Sputnik DAO with veil-williams.testnet as the sole council, approving a router payout that the recipient scanner found.

Veil uses NEAR's existing implicit accounts, so no new account type or protocol change is required. Amounts, timing, senders, token contracts, and network metadata remain public. Sweeping several stealth accounts to one destination can relink them. This is a testnet prototype, not an audited privacy system.
'@
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$synth.Volume = 95
$synth.SetOutputToWaveFile('results/video-assets/voiceover.wav')
$synth.Speak($text)
$synth.Dispose()
Write-Output 'voiceover generated'
