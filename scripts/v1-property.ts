import { deriveStealth, generateKeys, ORDER, scanAnnouncement } from '../packages/sdk/src/crypto.js';

const recipient = generateKeys(0x123456789abcdef123456789abcdefn, 0x23456789abcdef123456789abcdefn);
const decoy = generateKeys(0x123456789abcdef123456789abcden, 0x23456789abcdef123456789abcden);
let state = 0x9e3779b97f4a7c15n;

function nextScalar(): bigint {
  state = (state * 6364136223846793005n + 1442695040888963407n) % (2n ** 256n);
  return (state % (ORDER - 1n)) + 1n;
}

const accounts = new Set<string>();
for (let index = 0; index < 10_000; index += 1) {
  const derived = deriveStealth(recipient.spendPublicKey, recipient.viewPublicKey, nextScalar(), index);
  accounts.add(derived.stealthAccount);
  if (!scanAnnouncement(recipient, derived).owned) throw new Error(`false negative at index ${index}`);
}
for (let index = 0; index < 256; index += 1) {
  const derived = deriveStealth(decoy.spendPublicKey, decoy.viewPublicKey, nextScalar(), index);
  if (scanAnnouncement(recipient, derived).owned) throw new Error(`false positive at index ${index}`);
}
if (accounts.size !== 10_000) throw new Error(`expected 10,000 distinct accounts, got ${accounts.size}`);
console.log(JSON.stringify({ property: 'V1', sends: 10_000, decoys: 256, falseNegatives: 0, falsePositives: 0, distinctAccounts: accounts.size }));
