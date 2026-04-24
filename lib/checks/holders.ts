import type { CheckResult } from "./types";

type RpcResponse<T> = { result?: T; error?: { message: string } };

type LargestAccountsValue = {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
};

type SupplyValue = {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
};

export type HoldersDetails = {
  top10Pct: number | null;
  top10Addresses: Array<{ address: string; pct: number }>;
  supplyUi: number | null;
  error?: string;
};

async function rpc<T>(
  endpoint: string,
  method: string,
  params: unknown[]
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${method}`);
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${method}`);
      } else {
        const json = (await res.json()) as RpcResponse<T>;
        if (json.error) throw new Error(json.error.message);
        if (json.result === undefined) throw new Error(`No result for ${method}`);
        return json.result;
      }
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Top-10 holder concentration. Spec: <25%=PASS, 25–45%=WARN, >45%=FAIL.
 * "Bar is loose because memecoin winners often have 35%+ bundles."
 */
export async function checkHolders(
  mint: string
): Promise<CheckResult<HoldersDetails>> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) {
    return {
      status: "UNKNOWN",
      details: {
        top10Pct: null,
        top10Addresses: [],
        supplyUi: null,
        error: "HELIUS_API_KEY not set",
      },
    };
  }

  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${key}`;

  try {
    const [supplyRes, largestRes] = await Promise.all([
      rpc<{ value: SupplyValue }>(endpoint, "getTokenSupply", [mint]),
      rpc<{ value: LargestAccountsValue[] }>(endpoint, "getTokenLargestAccounts", [mint]),
    ]);

    const totalSupply = supplyRes.value.uiAmount;
    if (!totalSupply || totalSupply <= 0) {
      throw new Error("Invalid total supply");
    }

    const top10 = largestRes.value.slice(0, 10);
    const top10Sum = top10.reduce((sum, h) => sum + (h.uiAmount ?? 0), 0);
    const top10Pct = (top10Sum / totalSupply) * 100;

    const details: HoldersDetails = {
      top10Pct,
      top10Addresses: top10.map((h) => ({
        address: h.address,
        pct: (h.uiAmount / totalSupply) * 100,
      })),
      supplyUi: totalSupply,
    };

    if (top10Pct < 25) return { status: "PASS", details };
    if (top10Pct <= 45) return { status: "WARN", details };
    return { status: "FAIL", details };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "UNKNOWN",
      details: {
        top10Pct: null,
        top10Addresses: [],
        supplyUi: null,
        error: msg,
      },
    };
  }
}
