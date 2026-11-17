const TONES = {
  emerald: {
    wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700/50",
    bar: "from-emerald-500 to-emerald-700",
    val: "text-slate-900 dark:text-white",
  },
  teal: {
    wrap: "bg-teal-50 text-teal-700 ring-teal-200/80 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-700/50",
    bar: "from-teal-500 to-teal-700",
    val: "text-slate-900 dark:text-white",
  },
  amber: {
    wrap: "bg-amber-50 text-amber-600 ring-amber-200/80 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700/50",
    bar: "from-amber-400 to-amber-600",
    val: "text-slate-900 dark:text-white",
  },
  rose: {
    wrap: "bg-rose-50 text-rose-600 ring-rose-200/80 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700/50",
    bar: "from-rose-500 to-rose-600",
    val: "text-rose-700 dark:text-rose-300",
  },
  blue: {
    wrap: "bg-sky-50 text-sky-600 ring-sky-200/80 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-700/50",
    bar: "from-sky-500 to-blue-600",
    val: "text-slate-900 dark:text-white",
  },
  violet: {
    wrap: "bg-violet-50 text-violet-600 ring-violet-200/80 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-700/50",
    bar: "from-violet-500 to-purple-600",
    val: "text-slate-900 dark:text-white",
  },
  slate: {
    wrap: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600",
    bar: "from-slate-500 to-slate-700",
    val: "text-slate-900 dark:text-white",
  },
};

export default function StatCard({ icon: Icon, value, label, subtitle, tone = "emerald", loading = false, onClick }) {
  const t = TONES[tone] || TONES.emerald;
  return (
    <div
      onClick={onClick}
      className={`card group relative overflow-hidden p-4 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover" : "hover:shadow-card-hover"}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar} opacity-80`} />
      <div className="flex items-center gap-3.5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-200 group-hover:scale-105 ${t.wrap}`}>
          {Icon && <Icon size={24} strokeWidth={2.2} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-2xl font-extrabold tracking-tight ${t.val}`}>
            {loading ? <span className="inline-block h-7 w-14 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" /> : value}
          </div>
          <div className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
          {subtitle && <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}
