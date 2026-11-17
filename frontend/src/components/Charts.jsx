import { useState } from "react";

// Smooth responsive Area + Line Chart (Page 1: Statistik Peminjaman Buku)
export function AreaLineChart({ data = [], height = 200 }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 480;
  const h = height;
  const padL = 36, padR = 18, padT = 18, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxVal = Math.max(...data.map((d) => Number(d.value || 0)), 10);
  const ceilMax = Math.ceil(maxVal / 10) * 10;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(ceilMax * t));

  const pts = data.map((d, i) => {
    const x = padL + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
    const y = padT + innerH - ((Number(d.value || 0) / (ceilMax || 1)) * innerH);
    return { ...d, x, y };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = pts.length
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    : "";

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="athAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = padT + innerH - (t / (ceilMax || 1)) * innerH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{t}</text>
            </g>
          );
        })}
        {areaPath && <path d={areaPath} fill="url(#athAreaFill)" />}
        {linePath && <path d={linePath} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <g key={p.label + i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={hoverIdx === i ? 6 : 4.5} fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
            <text x={p.x} y={h - 8} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="600">{p.label}</text>
            {hoverIdx === i && (
              <g>
                <rect x={p.x - 24} y={p.y - 30} width="48" height="22" rx="6" fill="#064e3b" />
                <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="11" fill="#ffffff" fontWeight="700">{p.value}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

const DEFAULT_COLORS = ["#059669", "#22c55e", "#facc15", "#38bdf8", "#a855f7", "#fb923c", "#f43f5e", "#94a3b8"];

// Clean Donut Chart with Center Metric & Legend (Pages 1, 9, 10, 11)
export function DonutChart({ segments = [], centerValue, centerLabel = "", size = 148 }) {
  const total = segments.reduce((a, s) => a + Number(s.value || 0), 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" className="-rotate-90 w-full h-full">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="20" className="dark:stroke-slate-700" />
          {total > 0 && segments.map((s, idx) => {
            const val = Number(s.value || 0);
            if (!val) return null;
            const dash = (val / total) * c;
            const seg = (
              <circle
                key={s.label + idx}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                strokeWidth="20"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-slate-800 dark:text-white">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{centerLabel}</span>}
        </div>
      </div>
      <div className="flex-1 space-y-2 text-sm">
        {segments.map((s, idx) => {
          const val = Number(s.value || 0);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={s.label + idx} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length] }} />
                <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">{s.label}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-slate-800 dark:text-white">
                {s.showPctOnly ? `${pct}%` : `${val} (${pct}%)`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vertical Bar Chart (Page 9: Statistik Kunjungan)
export function BarChart({ data = [], height = 180 }) {
  const maxVal = Math.max(...data.map((d) => Number(d.value || 0)), 10);
  return (
    <div className="flex items-end justify-between gap-3 pt-6" style={{ height }}>
      {data.map((d, i) => {
        const pct = Math.max((Number(d.value || 0) / maxVal) * 100, d.value > 0 ? 8 : 3);
        return (
          <div key={d.label + i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{d.value}</span>
            <div className="flex w-full max-w-[44px] flex-1 items-end rounded-t-xl bg-emerald-50/70 dark:bg-slate-700/50">
              <div
                style={{ height: `${pct}%` }}
                className="w-full rounded-t-xl bg-gradient-to-t from-emerald-700 to-emerald-400 transition-all duration-500"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal Progress Distribution (Page 5: Distribusi Buku per Rak)
export function HorizontalBarList({ items = [] }) {
  const maxVal = Math.max(...items.map((i) => Number(i.value || 0)), 1);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = Math.max(Math.round((Number(item.value || 0) / maxVal) * 100), item.value > 0 ? 6 : 0);
        return (
          <div key={item.label + idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="truncate text-slate-700 dark:text-slate-200">{item.label}</span>
              <span className="text-emerald-800 dark:text-emerald-300">{item.value}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-slate-700">
              <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
