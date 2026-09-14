import type { ForecastPoint, PricePoint } from "@/lib/crypto/types";
import { logReturns, mean, standardDeviation } from "@/lib/finance/metrics";

export function buildForecast(history: PricePoint[], historicalDays: number, horizon: number): ForecastPoint[] {
  const sample = history.slice(-(historicalDays + 1));
  const returns = logReturns(sample);
  if (returns.length < Math.min(6, historicalDays - 1)) throw new Error("Histórico insuficiente para calcular el escenario");

  const drift = mean(returns);
  const sigma = standardDeviation(returns);
  const startPrice = sample.at(-1)!.price;
  const startTime = sample.at(-1)!.timestamp;

  return Array.from({ length: horizon + 1 }, (_, day) => {
    const rootTime = Math.sqrt(day);
    const base = startPrice * Math.exp(drift * day);
    const uncertainty = 1.28 * sigma * rootTime;
    return {
      day,
      timestamp: startTime + day * 86_400_000,
      base,
      optimistic: startPrice * Math.exp(drift * day + sigma * rootTime),
      pessimistic: startPrice * Math.exp(drift * day - sigma * rootTime),
      lower80: base * Math.exp(-uncertainty),
      upper80: base * Math.exp(uncertainty),
    };
  });
}
