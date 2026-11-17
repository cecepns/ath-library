import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, ArrowLeftRight, Users, UserCheck, Coins,
  Printer, Download, FileSpreadsheet, Info, PieChart, Layers, CheckCircle2,
  BookMarked, AlertTriangle, PackageX, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { DonutChart } from "@/components/Charts";
import { api } from "@/utils/api";
import { exportCSV } from "@/utils/csv";
import { formatDateID, rupiah } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const REPORT_CARDS = [
  { key: "koleksi", path: "/laporan/koleksi", title: "Laporan Koleksi", desc: "Data jumlah dan sebaran buku", icon: BookOpen },
  { key: "transaksi", path: "/laporan/transaksi", title: "Laporan Transaksi", desc: "Peminjaman, pengembalian & perpanjangan", icon: ArrowLeftRight },
  { key: "kunjungan", path: "/laporan/kunjungan", title: "Laporan Kunjungan", desc: "Data kunjungan anggota", icon: Users },
  { key: "anggota", path: "/laporan/anggota", title: "Laporan Anggota", desc: "Data anggota perpustakaan", icon: UserCheck },
  { key: "keuangan", path: "/laporan/keuangan", title: "Laporan Keuangan", desc: "Pemasukan & pengeluaran perpustakaan", icon: Coins },
];

export default function Reports() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = REPORT_CARDS.find((r) => location.pathname.includes(r.key))?.key || "koleksi";

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [categoryId, setCategoryId] = useState("");
  const [shelfId, setShelfId] = useState("");
  const [status, setStatus] = useState("");
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(E.CATEGORIES.LIST, { params: { limit: 100 } }).then(({ data: r }) => setCategories(r.data || [])).catch(() => {});
    api.get(E.SHELVES.LIST, { params: { limit: 100 } }).then(({ data: r }) => setShelves(r.data || [])).catch(() => {});
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const endpointMap = {
        koleksi: E.REPORTS.COLLECTION,
        transaksi: E.REPORTS.TRANSACTIONS,
        kunjungan: E.REPORTS.VISITS,
        anggota: E.REPORTS.MEMBERS,
        keuangan: E.REPORTS.FINANCE,
      };
      const { data: res } = await api.get(endpointMap[activeKey], {
        params: { year, category_id: categoryId || undefined, shelf_id: shelfId || undefined, status: status || undefined },
      });
      setData(res.data);
    } catch {
      toast.error("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [activeKey, year]);

  const handleExportCSV = () => {
    if (!data) return;
    if (activeKey === "koleksi") {
      exportCSV("laporan-koleksi.csv", ["Kategori", "Judul", "Eksemplar", "Tersedia", "Dipinjam", "Rusak", "Hilang"],
        (data.rows || []).map((r) => [r.category_name, r.total_titles, r.total_copies, r.available_copies, r.borrowed_copies, r.damaged_books, r.lost_books]));
    } else if (activeKey === "transaksi") {
      exportCSV("laporan-transaksi.csv", ["No. Transaksi", "Tanggal Pinjam", "Jatuh Tempo", "Anggota", "Buku", "Biaya", "Denda", "Status"],
        (data.rows || []).map((r) => [r.trx_no, r.loan_date, r.due_date, r.member_name, r.titles, r.fee, r.fine, r.display_status]));
    } else if (activeKey === "kunjungan") {
      exportCSV("laporan-kunjungan.csv", ["Tanggal", "Masuk", "Keluar", "Anggota", "Kamar", "Keperluan"],
        (data.rows || []).map((r) => [r.visit_date, r.check_in, r.check_out, r.member_name, r.room, r.purpose]));
    } else if (activeKey === "anggota") {
      exportCSV("laporan-anggota.csv", ["No. Anggota", "Nama", "Jenjang", "Kamar", "Total Pinjam", "Total Kunjungan"],
        (data.topBorrowers || []).map((r) => [r.member_no, r.name, r.level, r.room, r.total_loans, r.total_visits]));
    } else if (activeKey === "keuangan") {
      exportCSV("laporan-keuangan.csv", ["Tanggal", "Referensi", "Keterangan", "Jenis", "Nominal", "Metode"],
        (data.ledger || []).map((r) => [r.trx_date, r.ref_no, r.description, r.type, r.amount, r.payment_method]));
    }
    toast.success("Laporan berhasil diekspor ke Excel/CSV");
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 10) */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
          <BarChart3 size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Laporan Perpustakaan</h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lihat, rekap, dan cetak berbagai laporan kegiatan perpustakaan</p>
        </div>
      </div>

      {/* 5 Top Report Category Selector Cards (Page 10) */}
      <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REPORT_CARDS.map(({ key, path, title, desc, icon: Icon }) => {
          const active = activeKey === key;
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-emerald-600 bg-emerald-50 shadow-md ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/50"
                  : "border-emerald-900/10 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"}`}>
                <Icon size={21} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-emerald-950 dark:text-white">{title}</div>
                <div className="line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter + Action Toolbar */}
      <div className="no-print card flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Periode Tahun</label>
            <select className="input w-32" value={year} onChange={(e) => setYear(e.target.value)}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>Tahun {y}</option>)}
            </select>
          </div>
          {activeKey === "koleksi" && (
            <>
              <div>
                <label className="label">Kategori</label>
                <select className="input w-44" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Semua Kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Rak</label>
                <select className="input w-40" value={shelfId} onChange={(e) => setShelfId(e.target.value)}>
                  <option value="">Semua Rak</option>
                  {shelves.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>
            </>
          )}
          {(activeKey === "koleksi" || activeKey === "transaksi") && (
            <div>
              <label className="label">Status</label>
              <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Semua Status</option>
                {activeKey === "koleksi" ? (
                  <>
                    <option value="tersedia">Tersedia</option>
                    <option value="dipinjam">Dipinjam</option>
                    <option value="rusak">Rusak</option>
                    <option value="hilang">Hilang</option>
                  </>
                ) : (
                  <>
                    <option value="borrowed">Dipinjam</option>
                    <option value="overdue">Terlambat</option>
                    <option value="returned">Dikembalikan</option>
                  </>
                )}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={fetchReport}>
            <RefreshCw size={15} /> Tampilkan
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Cetak / PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Ekspor Excel (CSV)
          </button>
        </div>
      </div>

      {/* REPORT CONTENT */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-slate-400">Memuat data laporan...</div>
      ) : activeKey === "koleksi" && data ? (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="card overflow-hidden xl:col-span-8">
            <div className="card-header">
              <div className="font-bold text-emerald-950 dark:text-white">Hasil Laporan Koleksi Buku</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-emerald-800 text-xs text-white">
                  <tr>
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">Kategori Buku</th>
                    <th className="px-4 py-3">Judul</th>
                    <th className="px-4 py-3">Eksemplar</th>
                    <th className="px-4 py-3">Tersedia</th>
                    <th className="px-4 py-3">Dipinjam</th>
                    <th className="px-4 py-3">Rusak</th>
                    <th className="px-4 py-3">Hilang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {(data.rows || []).map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold">{r.category_name}</td>
                      <td className="px-4 py-2.5">{r.total_titles}</td>
                      <td className="px-4 py-2.5 font-bold">{r.total_copies}</td>
                      <td className="px-4 py-2.5 text-emerald-700 font-semibold">{r.available_copies}</td>
                      <td className="px-4 py-2.5 text-amber-700 font-semibold">{r.borrowed_copies}</td>
                      <td className="px-4 py-2.5 text-rose-600">{r.damaged_books}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.lost_books}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 font-extrabold text-emerald-950 dark:bg-emerald-950/50 dark:text-white">
                    <td colSpan={2} className="px-4 py-3 text-center">Total</td>
                    <td className="px-4 py-3">{data.summary?.total_titles}</td>
                    <td className="px-4 py-3">{data.summary?.total_copies}</td>
                    <td className="px-4 py-3">{data.summary?.available_copies}</td>
                    <td className="px-4 py-3">{data.summary?.borrowed_copies}</td>
                    <td className="px-4 py-3">{data.summary?.damaged_books}</td>
                    <td className="px-4 py-3">{data.summary?.lost_books}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5 xl:col-span-4">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2 font-bold"><Info size={17} className="text-emerald-700" /> Ringkasan Koleksi</div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 text-xs">
                {[
                  [BookOpen, data.summary?.total_titles, "Total Judul", "text-emerald-700 bg-emerald-50"],
                  [BookMarked, data.summary?.borrowed_copies, "Buku Dipinjam", "text-amber-700 bg-amber-50"],
                  [Layers, data.summary?.total_copies, "Total Eksemplar", "text-teal-700 bg-teal-50"],
                  [AlertTriangle, data.summary?.damaged_books, "Buku Rusak", "text-rose-600 bg-rose-50"],
                  [CheckCircle2, data.summary?.available_copies, "Buku Tersedia", "text-emerald-700 bg-emerald-50"],
                  [PackageX, data.summary?.lost_books, "Buku Hilang", "text-slate-600 bg-slate-100"],
                ].map(([Icon, val, lbl, cls]) => (
                  <div key={lbl} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5 dark:border-slate-700">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon size={17} /></span>
                    <div><div className="text-base font-extrabold">{val ?? 0}</div><div className="text-[11px] text-slate-500">{lbl}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2 font-bold"><PieChart size={17} className="text-emerald-700" /> Sebaran Koleksi per Kategori</div>
              </div>
              <div className="p-4">
                <DonutChart
                  centerValue={data.summary?.total_copies ?? 0}
                  centerLabel="Eksemplar"
                  segments={(data.rows || []).filter((r) => Number(r.total_copies) > 0).map((r) => ({ label: r.category_name, value: Number(r.total_copies), showPctOnly: true }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : activeKey === "transaksi" && data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="card p-4"><div className="text-xs text-slate-500">Total Transaksi</div><div className="text-2xl font-extrabold">{data.summary?.total_trx}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Sedang Dipinjam</div><div className="text-2xl font-extrabold text-sky-700">{data.summary?.borrowed}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Terlambat</div><div className="text-2xl font-extrabold text-rose-600">{data.summary?.overdue}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Total Biaya Pinjam</div><div className="text-xl font-extrabold text-emerald-700">{rupiah(data.summary?.total_fee)}</div></div>
            <div className="card p-4"><div className="text-xs text-slate-500">Total Denda</div><div className="text-xl font-extrabold text-amber-600">{rupiah(data.summary?.total_fine)}</div></div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">No. Transaksi</th><th className="px-4 py-3">Anggota</th><th className="px-4 py-3">Buku</th><th className="px-4 py-3">Pinjam</th><th className="px-4 py-3">Jatuh Tempo</th><th className="px-4 py-3">Biaya</th><th className="px-4 py-3">Denda</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data.rows || []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{r.trx_no}</td>
                    <td className="px-4 py-2.5 font-semibold">{r.member_name}</td>
                    <td className="px-4 py-2.5">{r.titles}</td>
                    <td className="px-4 py-2.5">{formatDateID(r.loan_date)}</td>
                    <td className="px-4 py-2.5">{formatDateID(r.due_date)}</td>
                    <td className="px-4 py-2.5">{rupiah(r.fee)}</td>
                    <td className="px-4 py-2.5">{rupiah(r.fine)}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${r.display_status === "returned" ? "bg-emerald-100 text-emerald-700" : r.display_status === "overdue" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>{r.display_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeKey === "kunjungan" && data ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="card overflow-x-auto lg:col-span-7">
            <div className="card-header"><span className="font-bold">Rekap Kunjungan per Kamar ({data.total_visits} kunjungan)</span></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">Kamar</th><th className="px-4 py-3">Total Kunjungan</th><th className="px-4 py-3">Anggota Unik</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data.byRoom || []).map((r) => (
                  <tr key={r.room}><td className="px-4 py-2.5 font-bold">{r.room}</td><td className="px-4 py-2.5 text-emerald-700 font-bold">{r.total_visits}</td><td className="px-4 py-2.5">{r.unique_members}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card lg:col-span-5">
            <div className="card-header"><span className="font-bold">Distribusi Keperluan</span></div>
            <div className="p-5">
              <DonutChart centerValue={data.total_visits} centerLabel="Kunjungan" segments={(data.byPurpose || []).map((p) => ({ label: p.purpose, value: Number(p.total) }))} />
            </div>
          </div>
        </div>
      ) : activeKey === "anggota" && data ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="card overflow-x-auto lg:col-span-5">
            <div className="card-header"><span className="font-bold">Sebaran Anggota per Jenjang</span></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">Jenjang</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Aktif</th><th className="px-4 py-3">Nonaktif</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data.byLevel || []).map((l) => (
                  <tr key={l.level}><td className="px-4 py-2.5 font-bold">{l.level}</td><td className="px-4 py-2.5">{l.total}</td><td className="px-4 py-2.5 text-emerald-700 font-bold">{l.active}</td><td className="px-4 py-2.5 text-rose-600">{l.inactive}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-x-auto lg:col-span-7">
            <div className="card-header"><span className="font-bold">Anggota Paling Aktif (Peminjam & Pengunjung)</span></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">No. Anggota</th><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Jenjang</th><th className="px-4 py-3">Pinjam</th><th className="px-4 py-3">Kunjungan</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data.topBorrowers || []).map((m) => (
                  <tr key={m.id}><td className="px-4 py-2.5 font-mono text-xs font-bold">{m.member_no}</td><td className="px-4 py-2.5 font-semibold">{m.name}</td><td className="px-4 py-2.5">{m.level || "-"}</td><td className="px-4 py-2.5 font-bold text-emerald-700">{m.total_loans}</td><td className="px-4 py-2.5 font-bold text-sky-700">{m.total_visits}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeKey === "keuangan" && data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="card border-l-4 border-emerald-600 p-4"><div className="text-xs text-slate-500">Total Pemasukan ({data.year})</div><div className="text-2xl font-extrabold text-emerald-700">{rupiah(data.total_income)}</div><div className="text-[11px] text-slate-400">Biaya: {rupiah(data.paid_fees)} · Denda: {rupiah(data.paid_fines)}</div></div>
            <div className="card border-l-4 border-rose-500 p-4"><div className="text-xs text-slate-500">Total Pengeluaran ({data.year})</div><div className="text-2xl font-extrabold text-rose-600">{rupiah(data.total_expense)}</div><div className="text-[11px] text-slate-400">Pembelian koleksi buku</div></div>
            <div className="card border-l-4 border-sky-600 p-4"><div className="text-xs text-slate-500">Saldo Bersih</div><div className="text-2xl font-extrabold text-slate-900 dark:text-white">{rupiah(data.net_balance)}</div></div>
            <div className="card border-l-4 border-amber-500 p-4"><div className="text-xs text-slate-500">Piutang Belum Dibayar</div><div className="text-2xl font-extrabold text-amber-600">{rupiah(data.unpaid_receivables)}</div></div>
          </div>
          <div className="card overflow-x-auto">
            <div className="card-header"><span className="font-bold">Buku Kas & Rincian Arus Keuangan Tahun {data.year}</span></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">No. Ref</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Metode</th><th className="px-4 py-3 text-right">Nominal</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data.ledger || []).length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Belum ada transaksi keuangan pada tahun {data.year}</td></tr>
                ) : (
                  (data.ledger || []).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5">{formatDateID(row.trx_date)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{row.ref_no}</td>
                      <td className="px-4 py-2.5 font-medium">{row.description}</td>
                      <td className="px-4 py-2.5"><span className={`badge ${row.type === "Pemasukan" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{row.type}</span></td>
                      <td className="px-4 py-2.5">{row.payment_method || "Tunai"}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${row.type === "Pemasukan" ? "text-emerald-700" : "text-rose-600"}`}>
                        {row.type === "Pemasukan" ? "+" : "-"} {rupiah(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
