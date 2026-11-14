import type { JsonRpcProvider } from 'near-api-js';

// router get_announcements returns at most 100 rows per call (contracts/router/src/lib.rs).
export const ROUTER_PAGE = 100;

export async function allAnnouncements(provider: JsonRpcProvider, routerId: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += ROUTER_PAGE) {
    const batch = await provider.callFunction({
      contractId: routerId,
      method: 'get_announcements',
      args: { from_index: from, limit: ROUTER_PAGE },
      blockQuery: { finality: 'final' },
    }) as any[];
    rows.push(...batch);
    if (batch.length < ROUTER_PAGE) return rows;
  }
}

// The derivation index for the next send (same rule as the web app and @veil/sdk).
export async function totalAnnouncements(provider: JsonRpcProvider, routerId: string): Promise<number> {
  return Number(await provider.callFunction({
    contractId: routerId,
    method: 'total_announcements',
    args: {},
    blockQuery: { finality: 'final' },
  }));
}
