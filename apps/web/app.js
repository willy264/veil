const CONFIG = window.VEIL_CONFIG ?? {};
const RPC = CONFIG.rpcUrl ?? 'https://rpc.testnet.fastnear.com';
const REGISTRY = CONFIG.registryId ?? 'registry.veil-williams.testnet';
const ROUTER = CONFIG.routerId ?? 'router.veil-williams.testnet';

const $ = (id) => document.getElementById(id);
const encodeArgs = (args) => btoa(JSON.stringify(args));

async function view(contractId, methodName, args) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'query', params: {
      request_type: 'call_function', finality: 'final', account_id: contractId,
      method_name: methodName, args_base64: encodeArgs(args),
    }}),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? 'RPC error');
  const bytes = Uint8Array.from(payload.result.result);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function show(id, value) { $(id).textContent = JSON.stringify(value, null, 2); }

async function resolveName() {
  const output = $('resolve-output');
  output.textContent = 'Reading final state...';
  try { show('resolve-output', await view(REGISTRY, 'get_meta', { account_id: $('name').value.trim() })); }
  catch (error) { output.textContent = error.message; }
}

async function refreshAnnouncements() {
  const target = $('announcements');
  target.innerHTML = '<div class="empty">Reading final state...</div>';
  try {
    const rows = await view(ROUTER, 'get_announcements', { from_index: 0, limit: 25 });
    target.innerHTML = rows.length ? `<table><thead><tr><th>#</th><th>Token</th><th>View tag</th><th>Amount</th></tr></thead><tbody>${rows.slice(-10).reverse().map((row) => `<tr><td>${row.index}</td><td>${row.token}</td><td>${row.view_tag}</td><td>${row.amount ?? '-'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No announcements yet.</div>';
  } catch (error) { target.innerHTML = `<div class="empty error">${error.message}</div>`; }
}

function prepareSend() {
  const recipient = $('recipient').value.trim();
  const amount = $('amount').value.trim();
  show('send-output', { receiver: ROUTER, method: 'send_near', args: { recipient_name: recipient, amount_near: amount }, note: 'The SDK derives stealth_account, ephemeral_pub_hex, and view_tag before signing.' });
}

$('resolve').addEventListener('click', resolveName);
$('refresh').addEventListener('click', refreshAnnouncements);
$('prepare').addEventListener('click', prepareSend);
refreshAnnouncements();
