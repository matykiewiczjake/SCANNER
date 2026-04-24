import { NextResponse } from "next/server";
import { isSolanaAddress } from "@/lib/utils";
import { DexCache, searchPairsByQuery } from "@/lib/sources/dexscreener";
import { pickTopSolanaPair, runImportScan } from "@/lib/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportBody = {
  query?: string;
  /** Optional: if user already picked a result from a ticker search, pass the pairAddress. */
  pairAddress?: string;
  mint?: string;
};

export async function POST(req: Request) {
  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query && !body.mint) {
    return NextResponse.json({ error: "Provide 'query' (CA or ticker)" }, { status: 400 });
  }

  const cache = new DexCache();

  // Direct CA path.
  const candidateMint = body.mint ?? (isSolanaAddress(query) ? query : null);
  if (candidateMint) {
    const pair = await cache.getPair(candidateMint);
    if (!pair) {
      return NextResponse.json(
        { error: "No Solana pair found for contract address" },
        { status: 404 }
      );
    }
    const { scanId, candidateId } = await runImportScan({
      mint: candidateMint,
      pair,
    });
    return NextResponse.json({ scanId, candidateId, resolved: { mint: candidateMint, pair } });
  }

  // Ticker path — search DexScreener.
  const pairs = await searchPairsByQuery(query);
  if (pairs.length === 0) {
    return NextResponse.json(
      { error: `No Solana pairs found for "${query}"` },
      { status: 404 }
    );
  }

  // If the client already picked a specific pair, use that.
  if (body.pairAddress) {
    const picked = pairs.find((p) => p.pairAddress === body.pairAddress);
    if (!picked) {
      return NextResponse.json(
        { error: "pairAddress not in search results" },
        { status: 400 }
      );
    }
    const { scanId, candidateId } = await runImportScan({
      mint: picked.baseToken.address,
      pair: picked,
    });
    return NextResponse.json({ scanId, candidateId });
  }

  // Multiple matches → return candidates so client can disambiguate.
  if (pairs.length > 1) {
    const matches = pairs.slice(0, 10).map((p) => ({
      pairAddress: p.pairAddress,
      mint: p.baseToken.address,
      ticker: p.baseToken.symbol,
      name: p.baseToken.name,
      priceUsd: p.priceUsd ?? null,
      marketCap: p.marketCap ?? p.fdv ?? null,
      liquidityUsd: p.liquidity?.usd ?? null,
      dexUrl: p.url ?? null,
    }));
    return NextResponse.json({ matches });
  }

  // Single match → auto-scan.
  const pair = pickTopSolanaPair(pairs);
  if (!pair) {
    return NextResponse.json(
      { error: "No usable Solana pair in results" },
      { status: 404 }
    );
  }
  const { scanId, candidateId } = await runImportScan({
    mint: pair.baseToken.address,
    pair,
  });
  return NextResponse.json({ scanId, candidateId });
}
