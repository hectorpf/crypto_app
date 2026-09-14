"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, BarChart3, Bitcoin, CircleDollarSign, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import type { AssetId, ChartPoint, Currency, ForecastPoint } from "@/lib/crypto/types";

type Metric = "price" | "returnPct" | "volatilityPct";
type ApiAsset = {
  id: AssetId; symbol: string; name: string; currentPrice: number;
  change24h: number; lastUpdated: number; chart: ChartPoint[];
};
type ApiResponse = {
  source: string; currency: Currency; fetchedAt: number; assets: ApiAsset[];
  forecast: { assetId: AssetId; historyDays: number; horizon: number; points: ForecastPoint[] };
};

const WINDOWS = [1, 7, 14, 30];
const HISTORY_WINDOWS = [7, 14, 30];
const HORIZONS = [1, 3, 7, 14, 30];

function money(value: number, currency: Currency, compact = false) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: currency.toUpperCase(),
    notation: compact ? "compact" : "standard", maximumFractionDigits: value > 100 ? 0 : 2,
  }).format(value);
}

function shortDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(timestamp);
}

function Change({ value }: { value: number }) {
  return <span className={value >= 0 ? "positive" : "negative"}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

export default function Home() {
  const [currency, setCurrency] = useState<Currency>("eur");
  const [windowDays, setWindowDays] = useState(30);
  const [metric, setMetric] = useState<Metric>("price");
  const [forecastAsset, setForecastAsset] = useState<AssetId>("bitcoin");
  const [historyDays, setHistoryDays] = useState(14);
  const [horizon, setHorizon] = useState(7);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        currency, asset: forecastAsset, history: String(historyDays), horizon: String(horizon),
      });
      if (forceRefresh) query.set("refresh", "1");
      const response = await fetch(`/api/market?${query}`, { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "La fuente de datos no está disponible");
      setData(payload);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setData(null);
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar datos reales");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [currency, forecastAsset, historyDays, horizon]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(undefined, true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const marketSeries = useMemo(() => {
    if (!data) return [];
    const rows = new Map<number, Record<string, number>>();
    for (const asset of data.assets) {
      for (const point of asset.chart.slice(-(windowDays + 1))) {
        const day = new Date(point.timestamp).setHours(0, 0, 0, 0);
        rows.set(day, { ...rows.get(day), timestamp: point.timestamp, [asset.symbol]: point[metric] });
      }
    }
    return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
  }, [data, metric, windowDays]);

  const forecastRows = useMemo(() => data?.forecast.points.map((point) => ({
    ...point, interval: [point.lower80, point.upper80],
  })) ?? [], [data]);
  const selectedForecast = data?.assets.find((asset) => asset.id === forecastAsset);
  const finalForecast = data?.forecast.points.at(-1);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Activity size={19} /></span><div><strong>CRYPTO PULSE</strong><small>Market intelligence</small></div></div>
        <div className="topbar-actions">
          <div className="live-status"><span /> ACTUALIZACIÓN · 60 S</div>
          <div className="segmented compact" aria-label="Moneda">
            {(["eur", "usd"] as Currency[]).map((item) => <button key={item} className={currency === item ? "active" : ""} onClick={() => setCurrency(item)}>{item.toUpperCase()}</button>)}
          </div>
          <button className="refresh-button" onClick={() => void load(undefined, true)} disabled={loading} aria-label="Actualizar datos">
            <RefreshCw size={17} className={loading ? "spin" : ""} /><span>Actualizar</span>
          </button>
        </div>
      </header>

      <section className="intro-row">
        <div><p className="eyebrow">MERCADO / BTC + ETH</p><h1>El mercado, sin ruido.</h1></div>
        <p className="source-note">Datos reales de <strong>CoinGecko</strong><br />{data ? `Consultados ${new Date(data.fetchedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Esperando respuesta de la API"}</p>
      </section>

      {error && <div className="error-banner" role="alert"><ShieldAlert size={20} /><div><strong>No mostramos datos inventados</strong><span>{error}. Inténtalo de nuevo en unos segundos.</span></div></div>}

      <section className="price-grid" aria-label="Cotizaciones actuales">
        {data?.assets.map((asset) => (
          <article className="price-card" key={asset.id}>
            <div className={`coin-icon ${asset.symbol.toLowerCase()}`}>{asset.symbol === "BTC" ? <Bitcoin size={22} /> : <span>Ξ</span>}</div>
            <div className="coin-name"><strong>{asset.symbol}</strong><span>{asset.name}</span></div>
            <div className="coin-price"><strong>{money(asset.currentPrice, currency)}</strong><Change value={asset.change24h} /></div>
            <div className="spark-line" aria-hidden="true"><span className={asset.change24h >= 0 ? "up" : "down"} /></div>
          </article>
        ))}
        {!data && !error && [0, 1].map((item) => <div className="price-card skeleton" key={item} />)}
      </section>

      <section className="panel market-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">HISTÓRICO</p><h2>Evolución comparada</h2></div>
          <div className="control-stack">
            <div className="segmented" aria-label="Métrica">
              <button className={metric === "price" ? "active" : ""} onClick={() => setMetric("price")}><CircleDollarSign size={15} /> Precio</button>
              <button className={metric === "returnPct" ? "active" : ""} onClick={() => setMetric("returnPct")}><TrendingUp size={15} /> Rentabilidad</button>
              <button className={metric === "volatilityPct" ? "active" : ""} onClick={() => setMetric("volatilityPct")}><BarChart3 size={15} /> Volatilidad</button>
            </div>
            <div className="segmented compact" aria-label="Ventana temporal">
              {WINDOWS.map((days) => <button key={days} className={windowDays === days ? "active" : ""} onClick={() => setWindowDays(days)}>{days}D</button>)}
            </div>
          </div>
        </div>
        <div className="legend"><span className="btc-dot" /> BTC <span className="eth-dot" /> ETH <em>{metric === "price" ? "precio de cierre" : metric === "returnPct" ? "variación diaria (%)" : "volatilidad anualizada móvil (%)"}</em></div>
        <div className="chart-wrap">
          {marketSeries.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={marketSeries} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#233044" vertical={false} strokeDasharray="3 6" />
            <XAxis dataKey="timestamp" tickFormatter={shortDate} stroke="#69758a" tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tickFormatter={(value) => metric === "price" ? money(value, currency, true) : `${value.toFixed(0)}%`} stroke="#69758a" tickLine={false} axisLine={false} width={62} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#101a29", border: "1px solid #2a3a52", borderRadius: 12 }} labelFormatter={(label) => new Date(Number(label)).toLocaleDateString("es-ES")} formatter={(value) => [metric === "price" ? money(Number(value), currency) : `${Number(value).toFixed(2)}%`]} />
            <Line type="monotone" dataKey="BTC" stroke="#f6b94a" strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="ETH" stroke="#8c7dff" strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 5 }} />
          </LineChart></ResponsiveContainer> : <div className="chart-empty">{error ? "Sin datos reales disponibles" : "Cargando histórico…"}</div>}
        </div>
      </section>

      <section className="forecast-layout">
        <aside className="forecast-controls panel">
          <div><p className="eyebrow">MODELO ESTADÍSTICO</p><h2>Forecast</h2><p className="muted">Configura la muestra y el horizonte. Cada cambio recalcula el escenario.</p></div>
          <label>Activo<select value={forecastAsset} onChange={(event) => setForecastAsset(event.target.value as AssetId)}><option value="bitcoin">Bitcoin · BTC</option><option value="ethereum">Ethereum · ETH</option></select></label>
          <label>Histórico utilizado<div className="segmented full">{HISTORY_WINDOWS.map((days) => <button key={days} className={historyDays === days ? "active" : ""} onClick={() => setHistoryDays(days)}>{days}D</button>)}</div></label>
          <label>Horizonte<div className="segmented full">{HORIZONS.map((days) => <button key={days} className={horizon === days ? "active" : ""} onClick={() => setHorizon(days)}>{days}D</button>)}</div></label>
          <div className="model-note"><ShieldAlert size={17} /><span>Escenarios basados en retornos y volatilidad histórica. <strong>No constituyen asesoramiento ni una certeza.</strong></span></div>
        </aside>

        <article className="panel forecast-chart-panel">
          <div className="panel-heading forecast-title"><div><p className="eyebrow">{selectedForecast?.symbol ?? "—"} · PROYECCIÓN</p><h2>{horizon} días desde {selectedForecast ? money(selectedForecast.currentPrice, currency) : "—"}</h2></div><span className="confidence-badge">BANDA 80%</span></div>
          <div className="chart-wrap forecast-chart">
            {forecastRows.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={forecastRows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <defs><linearGradient id="uncertainty" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6376ff" stopOpacity={0.28} /><stop offset="100%" stopColor="#6376ff" stopOpacity={0.04} /></linearGradient></defs>
              <CartesianGrid stroke="#233044" vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="timestamp" tickFormatter={shortDate} stroke="#69758a" tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickFormatter={(value) => money(value, currency, true)} stroke="#69758a" tickLine={false} axisLine={false} width={62} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#101a29", border: "1px solid #2a3a52", borderRadius: 12 }} labelFormatter={(label) => new Date(Number(label)).toLocaleDateString("es-ES")} formatter={(value, name) => [Array.isArray(value) ? `${money(Number(value[0]), currency)} — ${money(Number(value[1]), currency)}` : money(Number(value), currency), String(name)]} />
              <Area type="monotone" dataKey="interval" name="Intervalo 80%" stroke="none" fill="url(#uncertainty)" />
              <Line type="monotone" dataKey="optimistic" name="Optimista" stroke="#41d8a0" strokeWidth={1.7} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="base" name="Base" stroke="#f2f5fb" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="pessimistic" name="Pesimista" stroke="#ff7187" strokeWidth={1.7} dot={false} strokeDasharray="5 5" />
            </ComposedChart></ResponsiveContainer> : <div className="chart-empty">{error ? "Forecast no disponible sin datos reales" : "Calculando escenarios…"}</div>}
          </div>
          <div className="scenario-grid">
            <div><span>OPTIMISTA</span><strong className="positive">{finalForecast ? money(finalForecast.optimistic, currency) : "—"}</strong></div>
            <div><span>BASE</span><strong>{finalForecast ? money(finalForecast.base, currency) : "—"}</strong></div>
            <div><span>PESIMISTA</span><strong className="negative">{finalForecast ? money(finalForecast.pessimistic, currency) : "—"}</strong></div>
          </div>
        </article>
      </section>

      <footer><span>Fuente: CoinGecko API</span><span>La información es educativa y no constituye asesoramiento financiero.</span></footer>
    </main>
  );
}
