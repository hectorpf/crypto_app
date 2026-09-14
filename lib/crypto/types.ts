export type AssetId = "bitcoin" | "ethereum";
export type Currency = "eur" | "usd";

export type PricePoint = {
  timestamp: number;
  price: number;
};

export type AssetMarket = {
  id: AssetId;
  symbol: "BTC" | "ETH";
  name: "Bitcoin" | "Ethereum";
  currentPrice: number;
  change24h: number;
  lastUpdated: number;
  history: PricePoint[];
};

export type ChartPoint = {
  timestamp: number;
  price: number;
  returnPct: number;
  volatilityPct: number;
};

export type ForecastPoint = {
  day: number;
  timestamp: number;
  optimistic: number;
  base: number;
  pessimistic: number;
  lower80: number;
  upper80: number;
};
