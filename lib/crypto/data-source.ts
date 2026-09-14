import "server-only";
import type { AssetId, AssetMarket, Currency, PricePoint } from "./types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 30_000;
const marketCache = new Map<Currency, { savedAt: number; assets: AssetMarket[] }>();
const ASSETS: Array<{ id: AssetId; symbol: "BTC" | "ETH"; name: "Bitcoin" | "Ethereum" }> = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
];

async function getJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "crypto-pulse-dashboard/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`CoinGecko respondió con estado ${response.status}`);
  return response.json();
}

function dailyClose(rawPrices: unknown): PricePoint[] {
  if (!Array.isArray(rawPrices)) throw new Error("Histórico de precios no válido");
  const byDay = new Map<string, PricePoint>();
  for (const row of rawPrices) {
    if (!Array.isArray(row) || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) continue;
    const point = { timestamp: Number(row[0]), price: Number(row[1]) };
    byDay.set(new Date(point.timestamp).toISOString().slice(0, 10), point);
  }
  const points = [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (points.length < 7) throw new Error("CoinGecko no devolvió suficiente histórico");
  return points.slice(-31);
}

export async function fetchMarket(currency: Currency, forceRefresh = false): Promise<AssetMarket[]> {
  const cached = marketCache.get(currency);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.assets;

  const ids = ASSETS.map((asset) => asset.id).join(",");
  const simpleUrl = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_last_updated_at=true`;
  const [spot, ...histories] = await Promise.all([
    getJson(simpleUrl),
    ...ASSETS.map((asset) =>
      getJson(`${COINGECKO_BASE}/coins/${asset.id}/market_chart?vs_currency=${currency}&days=30`),
    ),
  ]);

  const assets = ASSETS.map((asset, index) => {
    const quote = spot?.[asset.id];
    const currentPrice = Number(quote?.[currency]);
    const change24h = Number(quote?.[`${currency}_24h_change`]);
    const lastUpdated = Number(quote?.last_updated_at) * 1000;
    if (![currentPrice, change24h, lastUpdated].every(Number.isFinite)) {
      throw new Error(`Cotización de ${asset.symbol} no válida`);
    }
    return {
      ...asset,
      currentPrice,
      change24h,
      lastUpdated,
      history: dailyClose(histories[index]?.prices),
    };
  });
  marketCache.set(currency, { savedAt: Date.now(), assets });
  return assets;
}

