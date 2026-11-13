import { writeFile } from 'node:fs/promises';

const value = (name, fallback) => process.env[name] || fallback;
const config = {
  rpcUrl: value('VEIL_RPC_URL', 'https://rpc.testnet.near.org'),
  registryId: value('VEIL_REGISTRY_ID', 'registry2.veil-williams.testnet'),
  routerId: value('VEIL_ROUTER_ID', 'router2.veil-williams.testnet'),
  network: 'testnet',
};
if (process.env.VEIL_NETWORK && process.env.VEIL_NETWORK !== 'testnet') throw new Error('Veil web build is testnet-only');
await writeFile('config.js', `window.VEIL_CONFIG = ${JSON.stringify(config)};\n`);
console.log(`Veil web build configured for ${config.network}`);
