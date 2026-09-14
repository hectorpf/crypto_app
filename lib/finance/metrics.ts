import type { ChartPoint, PricePoint } from "@/lib/crypto/types";

export function logReturns(points: PricePoint[]): number[] {
  return points.slice(1).map((point, index) => Math.log(point.price / points[index].price));
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

export function calculateChartSeries(points: PricePoint[], window = 7): ChartPoint[] {
  return points.map((point, index) => {
    const previous = points[index - 1];
    const dailyReturn = previous ? ((point.price / previous.price) - 1) * 100 : 0;
    const start = Math.max(1, index - window + 1);
    const localReturns = points
      .slice(start, index + 1)
      .map((item, localIndex, slice) => localIndex === 0 ? null : Math.log(item.price / slice[localIndex - 1].price))
      .filter((value): value is number => value !== null);
    return {
      ...point,
      returnPct: dailyReturn,
      volatilityPct: standardDeviation(localReturns) * Math.sqrt(365) * 100,
    };
  });
}
