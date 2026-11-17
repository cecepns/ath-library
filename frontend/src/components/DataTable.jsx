import { Search, Inbox, ChevronLeft, ChevronRight } from "lucide-react";

const LIMITS = [10, 25, 50, 100];

export default function DataTable({ columns, list, actions, placeholder = "Cari...", filters, onRowClick, selectedRowId }) {
  const { data, loading, error, pagination: pg, params, setParams, reload } = list;
  const pages = Array.from({ length: pg.totalPages || 1 }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === pg.totalPages || Math.abs(p - pg.page) <= 1);

  const startIdx = pg.total ? (pg.page - 1) * params.limit + 1 : 0;
  const endIdx = Math.min(pg.page * params.limit, pg.total || 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-slate-100 p-4 dark:border-slate-700 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder={placeholder}
            value={params.search}
            onChange={(e) => setParams((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          <select
            className="input w-28"
            value={params.limit}
            onChange={(e) => setParams((p) => ({ ...p, limit: +e.target.value, page: 1 }))}
          >
            {LIMITS.map((l) => (
              <option key={l} value={l}>{l} / hal</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-emerald-800 text-xs font-bold uppercase tracking-wider text-white">
            <tr>
              <th className="w-12 px-4 py-3.5">No</th>
              {columns.map((c) => (
                <th key={c.label} className={`whitespace-nowrap px-4 py-3.5 ${c.className || ""}`}>{c.label}</th>
              ))}
              {actions && <th className="px-4 py-3.5 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length + (actions ? 2 : 1)} className="px-4 py-3.5">
                  <div className="h-5 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
                </td>
              </tr>
            ))}
            {!loading && error && (
              <tr>
                <td colSpan={columns.length + (actions ? 2 : 1)} className="p-8 text-center text-rose-600">
                  {error}{" "}
                  <button className="font-semibold underline" onClick={reload}>Coba lagi</button>
                </td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={columns.length + (actions ? 2 : 1)} className="p-10 text-center text-slate-400">
                  <Inbox className="mx-auto mb-2 opacity-60" size={32} />
                  <p className="text-sm font-medium">Belum ada data yang sesuai</p>
                </td>
              </tr>
            )}
            {!loading && !error && data.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? "cursor-pointer" : ""} ${
                  selectedRowId && selectedRowId === row.id
                    ? "bg-emerald-50/90 dark:bg-emerald-900/30"
                    : "hover:bg-emerald-50/40 dark:hover:bg-slate-700/40"
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-500">{(pg.page - 1) * params.limit + i + 1}</td>
                {columns.map((c) => (
                  <td key={c.label} className={`px-4 py-3 ${c.cellClass || ""}`}>
                    {c.render ? c.render(row) : row[c.key] ?? "-"}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60 sm:flex-row">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Menampilkan <b className="text-slate-700 dark:text-slate-200">{startIdx}–{endIdx}</b> dari <b className="text-slate-700 dark:text-slate-200">{pg.total}</b> data
        </span>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm !px-2.5"
            disabled={pg.page <= 1}
            onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
          >
            <ChevronLeft size={16} />
          </button>
          {pages.map((p, idx) => (
            <span key={p} className="flex items-center gap-1">
              {idx > 0 && p - pages[idx - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
              <button
                onClick={() => setParams((s) => ({ ...s, page: p }))}
                className={`btn btn-sm min-w-[34px] ${p === pg.page ? "btn-primary" : "btn-ghost"}`}
              >
                {p}
              </button>
            </span>
          ))}
          <button
            className="btn btn-ghost btn-sm !px-2.5"
            disabled={pg.page >= pg.totalPages}
            onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
