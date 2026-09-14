import { NextRequest, NextResponse } from "next/server";
import { fetchMarket } from "@/lib/crypto/data-source";
import { calculateChartSeries } from "@/lib/finance/metrics";
import { buildForecast } from "@/lib/forecast/model";
import type { AssetId, Currency } from "@/lib/crypto/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const currency = (params.get("currency") ?? "eur").toLowerCase() as Currency;
  const assetId = (params.get("asset") ?? "bitcoin") as AssetId;
  const historyDays = Number(params.get("history") ?? 14);
  const horizon = Number(params.get("horizon") ?? 7);
  const forceRefresh = params.get("refresh") === "1";

  if (!["eur", "usd"].includes(currency) || !["bitcoin", "ethereum"].includes(assetId)) {
    return NextResponse.json({ error: "Parámetros de activo o moneda no válidos" }, { status: 400 });
  }
  if (![7, 14, 30].includes(historyDays) || ![1, 3, 7, 14, 30].includes(horizon)) {
    return NextResponse.json({ error: "Ventana de forecast no válida" }, { status: 400 });
  }

  try {
    const assets = await fetchMarket(currency, forceRefresh);
    const selected = assets.find((asset) => asset.id === assetId)!;
    return NextResponse.json({
      source: "CoinGecko",
      currency,
      fetchedAt: Date.now(),
      assets: assets.map((asset) => ({ ...asset, chart: calculateChartSeries(asset.history) })),
      forecast: {
        assetId,
        historyDays,
        horizon,
        points: buildForecast(selected.history, historyDays, horizon),
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido en la fuente de datos";
    return NextResponse.json(
      { error: "No se pudieron obtener datos reales de mercado.", detail: message, source: "CoinGecko" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
