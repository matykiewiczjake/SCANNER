import { fetchJson } from "@/lib/http";

const BIRDEYE = "https://public-api.birdeye.so";

export type Candle5m = {
  unixTime: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type RawCandle = {
  unixTime?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
};

type OhlcvResponse = {
  success?: boolean;
  data?: { items?: RawCandle[] };
};

export type OhlcvResult =
  | { ok: true; candles: Candle5m[] }
  | { ok: false; error: string };

/**
 * Birdeye 5m OHLCV for the last `hours`. Used by checks #6 (shakeout
 * survival) and #7 (5m higher-low) and the phase classifier — fetched once
 * per candidate, shared across all three.
 *
 * On any failure (key missing, gated tier, network) returns
 * `{ ok: false }` so callers can produce UNKNOWN cleanly.
 */
export async function fetchOhlcv5m(
  mint: string,
  hours: number
): Promise<OhlcvResult> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) return { ok: false, error: "BIRDEYE_API_KEY not set" };

  const now = Math.floor(Date.now() / 1000);
  const from = now - hours * 3600;
  const url =
    `${BIRDEYE}/defi/ohlcv` +
    `?address=${encodeURIComponent(mint)}` +
    `&type=5m` +
    `&time_from=${from}` +
    `&time_to=${now}`;

  try {
    const data = await fetchJson<OhlcvResponse>(url, {
      headers: {
        "X-API-KEY": key,
        "x-chain": "solana",
        accept: "application/json",
      },
    });
    const items = data.data?.items ?? [];
    const candles: Candle5m[] = [];
    for (const c of items) {
      if (
        typeof c.unixTime === "number" &&
        typeof c.o === "number" &&
        typeof c.h === "number" &&
        typeof c.l === "number" &&
        typeof c.c === "number"
      ) {
        candles.push({
          unixTime: c.unixTime,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
          volume: typeof c.v === "number" ? c.v : 0,
        });
      }
    }
    candles.sort((a, b) => a.unixTime - b.unixTime);
    return { ok: true, candles };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
