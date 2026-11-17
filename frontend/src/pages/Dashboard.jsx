import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Layers, BookMarked, CalendarClock, Users, DoorOpen,
  TrendingUp, Wallet, Zap, BookPlus, UserPlus, ArrowLeftRight, Undo2,
  ClipboardList, Bell, ChevronRight, Calendar, PackageCheck, Home,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import { AreaLineChart, DonutChart } from "@/components/Charts";
import { request } from "@/utils/request";
import { API_ENDPOINTS as E } from "@/utils/endpoints";
import { formatDateID, formatTodayHeader } from "@/utils/confirm";

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("6");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    request((a) => a.get(E.DASHBOARD, { params: { range } }))
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range]);

  const pay = data?.payment_summary || { total: 0, paid: 0, unpaid: 0 };

  return (
    <div className="space-y-6">
      {/* Page Title Bar */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md shadow-emerald-900/20">
            <Home size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Dashboard</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ringkasan aktivitas & statistik perpustakaan secara real-time</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-900/10 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:self-auto">
          <Calendar size={16} className="text-emerald-700" />
          {formatTodayHeader()}
        </div>
      </div>

      {/* 6 Rich Stat Cards with Icons (Page 1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={BookOpen} value={data?.titles ?? 0} label="Total Judul Buku" tone="emerald" loading={loading} onClick={() => navigate("/buku")} />
        <StatCard icon={Layers} value={data?.copies ?? 0} label="Total Eksemplar" tone="teal" loading={loading} onClick={() => navigate("/buku")} />
        <StatCard icon={BookMarked} value={data?.borrowed ?? 0} label="Sedang Dipinjam" tone="blue" loading={loading} onClick={() => navigate("/transaksi/riwayat")} />
        <StatCard icon={CalendarClock} value={data?.overdue ?? 0} label="Terlambat Kembali" tone="rose" loading={loading} onClick={() => navigate("/transaksi/pengembalian")} />
        <StatCard icon={Users} value={data?.members ?? 0} label="Anggota Aktif" tone="violet" loading={loading} onClick={() => navigate("/anggota")} />
        <StatCard icon={DoorOpen} value={data?.visits_today ?? 0} label="Kunjungan Hari Ini" tone="amber" loading={loading} onClick={() => navigate("/kunjungan")} />
      </div>

      {/* Middle Section: Area Chart + Payment Donut + Akses Cepat */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Statistik Peminjaman Buku */}
        <div className="card xl:col-span-5">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <TrendingUp size={18} />
              </span>
              <h3 className="font-bold text-emerald-950 dark:text-white">Statistik Peminjaman Buku</h3>
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="6">6 Bulan Terakhir</option>
              <option value="12">12 Bulan Terakhir</option>
            </select>
          </div>
          <div className="p-5">
            <AreaLineChart data={data?.loan_chart || []} height={210} />
          </div>
        </div>

        {/* Status Pembayaran Peminjaman */}
        <div className="card xl:col-span-4">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <Wallet size={18} />
              </span>
              <h3 className="font-bold text-emerald-950 dark:text-white">Status Pembayaran Peminjaman</h3>
            </div>
          </div>
          <div className="flex h-[calc(100%-60px)] items-center justify-center p-5">
            <DonutChart
              centerValue={pay.total}
              centerLabel="Transaksi"
              segments={[
                { label: "Sudah Bayar", value: pay.paid, color: "#059669" },
                { label: "Belum Bayar", value: pay.unpaid, color: "#facc15" },
              ]}
            />
          </div>
        </div>

        {/* Akses Cepat */}
        <div className="card border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800 xl:col-span-3">
          <div className="card-header bg-transparent">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
                <Zap size={18} />
              </span>
              <h3 className="font-bold text-emerald-950 dark:text-white">Akses Cepat</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              { to: "/buku/tambah", label: "Tambah Buku", icon: BookPlus, color: "text-emerald-700 bg-emerald-100" },
              { to: "/anggota?add=1", label: "Tambah Anggota", icon: UserPlus, color: "text-teal-700 bg-teal-100" },
              { to: "/transaksi/peminjaman", label: "Peminjaman", icon: ArrowLeftRight, color: "text-sky-700 bg-sky-100" },
              { to: "/transaksi/pengembalian", label: "Pengembalian", icon: Undo2, color: "text-amber-700 bg-amber-100" },
            ].map(({ to, label, icon: Icon, color }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-emerald-900/10 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md dark:border-slate-600 dark:bg-slate-900"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${color}`}>
                  <Icon size={23} />
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Transaksi Terbaru + Pengingat & Informasi */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Transaksi Terbaru */}
        <div className="card overflow-hidden xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <ClipboardList size={18} />
              </span>
              <h3 className="font-bold text-emerald-950 dark:text-white">Transaksi Terbaru</h3>
            </div>
            <Link to="/transaksi/riwayat" className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline dark:text-emerald-300">
              Lihat Semua →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Anggota</th>
                  <th className="px-4 py-3">Buku</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Pembayaran</th>
                  <th className="px-4 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data?.recent_transactions || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Belum ada transaksi tercatat</td>
                  </tr>
                ) : (
                  (data?.recent_transactions || []).map((t, idx) => (
                    <tr key={t.id} className="hover:bg-emerald-50/40 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDateID(t.loan_date)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                        {t.member_name} <span className="text-xs font-normal text-slate-400">({t.member_no})</span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-300" title={t.titles}>{t.titles}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${t.status === "returned" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {t.status === "returned" ? "Kembali" : "Pinjam"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${t.paid ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>
                          {t.paid ? (t.status === "returned" ? "Lunas" : "Sudah Bayar") : "Belum Bayar"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{t.officer_name || "Admin"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pengingat & Informasi */}
        <div className="card xl:col-span-4">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                <Bell size={18} />
              </span>
              <h3 className="font-bold text-emerald-950 dark:text-white">Pengingat & Informasi</h3>
            </div>
          </div>
          <div className="divide-y divide-slate-100 p-3 dark:divide-slate-700">
            <Link
              to="/transaksi/pengembalian"
              className="flex items-center justify-between gap-3 rounded-xl p-3.5 transition hover:bg-rose-50/70 dark:hover:bg-slate-700/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <CalendarClock size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{data?.overdue ?? 0} buku terlambat dikembalikan</div>
                  <div className="text-xs text-slate-500">Klik untuk proses pengembalian & denda</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </Link>

            <Link
              to="/transaksi/riwayat"
              className="flex items-center justify-between gap-3 rounded-xl p-3.5 transition hover:bg-amber-50/70 dark:hover:bg-slate-700/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Wallet size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{data?.unpaid ?? 0} transaksi belum dibayar</div>
                  <div className="text-xs text-slate-500">Klik untuk verifikasi pembayaran</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </Link>

            <Link
              to="/pengadaan/rencana"
              className="flex items-center justify-between gap-3 rounded-xl p-3.5 transition hover:bg-emerald-50/70 dark:hover:bg-slate-700/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <PackageCheck size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                    Usulan pengadaan buku ({data?.pending_procurements ?? 0})
                  </div>
                  <div className="text-xs text-slate-500">Lihat rencana pembelian & donasi</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
