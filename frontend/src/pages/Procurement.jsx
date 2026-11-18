import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShoppingCart, ClipboardList, Gift, History, BookOpen, CheckCircle2, PackageCheck,
  Layers, Plus, Trash2, Eye, Coins, Calendar, Users, Save, X, Minus, Info, Download,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { DonutChart } from "@/components/Charts";
import { useList } from "@/hooks/useList";
import { api } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast, formatDateID, rupiah, todayISO } from "@/utils/confirm";
import { exportCSV } from "@/utils/csv";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const TABS = [
  { key: "rencana", path: "/pengadaan/rencana", label: "Rencana Pengadaan", icon: ClipboardList },
  { key: "pembelian", path: "/pengadaan/pembelian", label: "Pembelian", icon: ShoppingCart },
  { key: "donasi", path: "/pengadaan/donasi", label: "Donasi", icon: Gift },
  { key: "riwayat", path: "/pengadaan/riwayat", label: "Riwayat Pengadaan", icon: History },
];

const STATUS_STYLE = {
  usulan: "bg-slate-100 text-slate-700",
  disetujui: "bg-emerald-100 text-emerald-800",
  dalam_proses: "bg-amber-100 text-amber-800",
  diterima: "bg-sky-100 text-sky-800",
  ditolak: "bg-rose-100 text-rose-700",
};
const STATUS_LABEL = {
  usulan: "Usulan",
  disetujui: "Disetujui",
  dalam_proses: "Dalam Proses",
  diterima: "Diterima",
  ditolak: "Ditolak",
};
const PRIORITY_STYLE = { Tinggi: "bg-rose-100 text-rose-700", Sedang: "bg-amber-100 text-amber-800", Rendah: "bg-emerald-100 text-emerald-700" };

// ======================================================
// TAB 1: RENCANA PENGADAAN (Page 11)
// ======================================================
function PlansTab({ categories }) {
  const list = useList(E.PROCUREMENT.PLANS);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ title: "", category_id: "", quantity: "1", priority: "Sedang", funding_source: "Pembelian", estimated_price: "", note: "" });
  const [saving, setSaving] = useState(false);

  const loadStats = () => api.get(E.PROCUREMENT.PLANS_STATS).then(({ data }) => setStats(data.data)).catch(() => {});
  useEffect(() => { loadStats(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Judul buku wajib diisi");
    setSaving(true);
    try {
      await request(
        (a) => a.post(E.PROCUREMENT.PLANS, { ...form, quantity: Math.max(1, Number(form.quantity) || 1), estimated_price: Math.max(0, Number(form.estimated_price) || 0) }),
        { success: "Rencana pengadaan tersimpan" }
      );
      setForm({ title: "", category_id: "", quantity: "1", priority: "Sedang", funding_source: "Pembelian", estimated_price: "", note: "" });
      list.reload();
      loadStats();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (row, status) => {
    await request((a) => a.put(E.PROCUREMENT.PLAN_DETAIL(row.id), { status }), { success: `Status diubah ke ${STATUS_LABEL[status]}` });
    list.reload();
    loadStats();
  };

  const remove = async (row) => {
    if (!(await confirmToast(`Hapus rencana "${row.title}"?`))) return;
    await request((a) => a.delete(E.PROCUREMENT.PLAN_DETAIL(row.id)), { success: "Rencana dihapus" });
    list.reload();
    loadStats();
  };

  return (
    <div className="space-y-5">
      {/* 5 Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={BookOpen} value={stats?.total_plans ?? 0} label="Usulan Buku" tone="emerald" loading={!stats} />
        <StatCard icon={CheckCircle2} value={stats?.approved ?? 0} label="Disetujui" tone="teal" loading={!stats} />
        <StatCard icon={ShoppingCart} value={stats?.in_progress ?? 0} label="Dalam Proses" tone="amber" loading={!stats} />
        <StatCard icon={PackageCheck} value={stats?.received ?? 0} label="Sudah Diterima" tone="blue" loading={!stats} />
        <StatCard icon={Layers} value={stats?.total_collection ?? 0} label="Total Koleksi" tone="violet" loading={!stats} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Form Tambah Rencana Pengadaan */}
        <div className="card xl:col-span-7">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Plus size={18} className="rounded-full bg-emerald-700 p-0.5 text-white" /> Tambah Rencana Pengadaan
            </div>
          </div>
          <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="label">Judul Buku *</label>
              <input className="input" required placeholder="Masukkan judul buku..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Pilih kategori...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jumlah *</label>
              <div className="flex items-center gap-1.5">
                <button type="button" className="btn btn-ghost !px-2.5" onClick={() => setForm((f) => ({ ...f, quantity: String(Math.max(1, (Number(f.quantity) || 1) - 1)) }))}><Minus size={14} /></button>
                <input
                  type="number"
                  min={1}
                  className="input text-center font-bold"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  onBlur={() => setForm((f) => ({ ...f, quantity: String(Math.max(1, Number(f.quantity) || 1)) }))}
                />
                <button type="button" className="btn btn-ghost !px-2.5" onClick={() => setForm((f) => ({ ...f, quantity: String((Number(f.quantity) || 0) + 1) }))}><Plus size={14} /></button>
              </div>
            </div>
            <div>
              <label className="label">Prioritas</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["Tinggi", "Sedang", "Rendah"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sumber Dana</label>
              <select className="input" value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })}>
                {["Pembelian", "Donasi", "Hibah", "Program/Kerja Sama"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Perkiraan Harga (Rp)</label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="0"
                value={form.estimated_price}
                onChange={(e) => setForm({ ...form, estimated_price: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Keterangan (Opsional)</label>
              <input className="input" placeholder="Contoh: buku pendukung pembelajaran..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <button className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Rencana"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setForm({ title: "", category_id: "", quantity: "1", priority: "Sedang", funding_source: "Pembelian", estimated_price: "", note: "" })}><X size={16} /> Batal</button>
            </div>
          </form>
        </div>

        {/* Right: Sumber Pengadaan Donut */}
        <div className="card xl:col-span-5">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Info size={18} className="text-emerald-700" /> Sumber Pengadaan
            </div>
          </div>
          <div className="flex h-[calc(100%-58px)] items-center justify-center p-5">
            <DonutChart
              centerValue={stats?.total_plans ?? 0}
              centerLabel="Usulan"
              segments={(stats?.by_source || []).map((s) => ({ label: s.label, value: Number(s.value), showPctOnly: true }))}
            />
          </div>
        </div>
      </div>

      {/* Daftar Rencana Pengadaan */}
      <DataTable
        list={list}
        placeholder="Cari judul buku, kategori, atau sumber dana..."
        columns={[
          { label: "Judul Buku", render: (r) => <span className="font-bold text-slate-800 dark:text-white">{r.title}</span> },
          { label: "Kategori", render: (r) => <span className="badge bg-emerald-100 text-emerald-800">{r.category_name || "Umum"}</span> },
          { label: "Jumlah", key: "quantity" },
          { label: "Prioritas", render: (r) => <span className={`badge ${PRIORITY_STYLE[r.priority] || ""}`}>{r.priority}</span> },
          { label: "Sumber Dana", key: "funding_source" },
          { label: "Perkiraan Harga", render: (r) => rupiah(r.estimated_price) },
          {
            label: "Status",
            render: (r) => (
              <select
                value={r.status}
                onChange={(e) => changeStatus(r, e.target.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none ${STATUS_STYLE[r.status] || ""}`}
              >
                {Object.entries(STATUS_LABEL).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            ),
          },
        ]}
        actions={(r) => (
          <button className="btn btn-danger btn-sm !px-2" onClick={() => remove(r)}><Trash2 size={14} /></button>
        )}
      />
    </div>
  );
}

// ======================================================
// TAB 2: PEMBELIAN BUKU (Page 12)
// ======================================================
function PurchasesTab({ categories }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    purchase_date: todayISO(),
    supplier: "",
    invoice_no: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    funding_source: "Dana Perpustakaan",
    payment_method: "Tunai",
    note: "",
  });
  const [items, setItems] = useState([{ title: "", category_id: "", quantity: "1", unit_price: "" }]);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    api.get(E.PROCUREMENT.PURCHASES_STATS).then(({ data }) => setStats(data.data)).catch(() => {});
    api.get(E.PROCUREMENT.PURCHASES).then(({ data }) => setRecent(data.data || [])).catch(() => {});
  };
  useEffect(() => { loadData(); }, []);

  const updateRow = (idx, key, val) => setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const totalCopies = items.reduce((a, r) => a + (Number(r.quantity) || 0), 0);
  const totalAmount = items.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.supplier.trim()) return toast.error("Nama pemasok / toko buku wajib diisi");
    if (!items.some((i) => i.title.trim())) return toast.error("Isi minimal 1 judul buku yang dibeli");
    setSaving(true);
    try {
      await request((a) => a.post(E.PROCUREMENT.PURCHASES, { ...form, items }), { success: "Data pembelian buku tersimpan!" });
      setForm((f) => ({ ...f, supplier: "", note: "", invoice_no: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}` }));
      setItems([{ title: "", category_id: "", quantity: "1", unit_price: "" }]);
      loadData();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    const { data } = await api.get(E.PROCUREMENT.PURCHASE_DETAIL(id));
    setDetail(data.data);
  };

  return (
    <div className="space-y-5">
      {/* 4 Summary Stat Cards (Page 12) */}
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} value={stats?.total_trx ?? 0} label="Transaksi Pembelian" tone="emerald" loading={!stats} />
        <StatCard icon={BookOpen} value={stats?.total_copies ?? 0} label="Total Eksemplar" tone="teal" loading={!stats} />
        <StatCard icon={Coins} value={rupiah(stats?.total_spent ?? 0)} label="Total Pengeluaran" tone="amber" loading={!stats} />
        <StatCard icon={Calendar} value={stats?.last_purchase_date ? formatDateID(stats.last_purchase_date) : "-"} label="Pembelian Terakhir" tone="blue" loading={!stats} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Form Tambah Pembelian Buku */}
        <div className="card xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Plus size={18} className="rounded-full bg-emerald-700 p-0.5 text-white" /> Tambah Pembelian Buku
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div><label className="label">Tanggal Pembelian *</label><input type="date" className="input" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Pemasok / Toko Buku *</label><input className="input" required placeholder="Contoh: Toko Buku Cahaya Ilmu" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
              <div><label className="label">No. Nota / Faktur</label><input className="input font-mono" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></div>
              <div>
                <label className="label">Sumber Dana</label>
                <select className="input" value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })}>
                  <option value="Dana Perpustakaan">Dana Perpustakaan</option>
                  <option value="BOS / Yayasan">BOS / Yayasan</option>
                  <option value="Infaq / Donatur">Infaq / Donatur</option>
                </select>
              </div>
              <div>
                <label className="label">Metode Pembayaran</label>
                <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer">Transfer</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-bold">Daftar Buku yang Dibeli</div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-800 text-white">
                    <tr><th className="px-3 py-2">Judul Buku</th><th className="px-3 py-2">Kategori</th><th className="w-20 px-3 py-2">Jml</th><th className="w-32 px-3 py-2">Harga Satuan</th><th className="px-3 py-2">Subtotal</th><th className="w-10 px-2 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2"><input className="input !py-1.5 text-xs" placeholder="Judul buku..." value={row.title} onChange={(e) => updateRow(idx, "title", e.target.value)} /></td>
                        <td className="p-2">
                          <select className="input !py-1.5 text-xs" value={row.category_id} onChange={(e) => updateRow(idx, "category_id", e.target.value)}>
                            <option value="">Umum</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><input type="number" min={1} className="input !py-1.5 text-center text-xs font-bold" placeholder="1" value={row.quantity} onChange={(e) => updateRow(idx, "quantity", e.target.value)} /></td>
                        <td className="p-2"><input type="number" min={0} className="input !py-1.5 text-xs" placeholder="0" value={row.unit_price} onChange={(e) => updateRow(idx, "unit_price", e.target.value)} /></td>
                        <td className="whitespace-nowrap px-3 py-2 font-bold text-emerald-700">{rupiah((Number(row.quantity) || 0) * (Number(row.unit_price) || 0))}</td>
                        <td className="p-2 text-center">
                          {items.length > 1 && (
                            <button type="button" className="text-rose-500 hover:text-rose-700" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { title: "", category_id: "", quantity: "1", unit_price: "" }])}>
                <Plus size={14} /> Tambah Baris
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 items-center">
              <div>
                <label className="label">Keterangan (Opsional)</label>
                <textarea rows={2} className="input" placeholder="Catatan pembelian..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-1 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex justify-between"><span>Total Judul</span><b>{items.filter((i) => i.title.trim()).length} judul</b></div>
                <div className="flex justify-between"><span>Total Eksemplar</span><b>{totalCopies} buku</b></div>
                <div className="flex justify-between border-t border-emerald-200 pt-1.5 text-sm">
                  <span className="font-bold">Total Pembelian</span>
                  <b className="text-emerald-800 dark:text-emerald-300">{rupiah(totalAmount)}</b>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary px-6" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Pembelian"}</button>
            </div>
          </form>
        </div>

        {/* Right: Informasi & Riwayat Pembelian Terbaru */}
        <div className="space-y-5 xl:col-span-4">
          <div className="card">
            <div className="card-header"><span className="font-bold">Informasi Pembelian</span></div>
            <div className="space-y-2.5 p-5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Total Judul Dibeli</span><b>{stats?.total_titles ?? 0} judul</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Eksemplar</span><b>{stats?.total_copies ?? 0} buku</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Pengeluaran</span><b className="text-emerald-800">{rupiah(stats?.total_spent ?? 0)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Jumlah Transaksi</span><b>{stats?.total_trx ?? 0} transaksi</b></div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><span className="font-bold">Riwayat Pembelian Terbaru</span></div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recent.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Belum ada data pembelian</div>
              ) : (
                recent.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{p.supplier}</div>
                      <div className="text-slate-400">{formatDateID(p.purchase_date)} · {p.total_copies} buku</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700">{rupiah(p.total_amount)}</span>
                      <button className="btn btn-ghost btn-sm !p-1.5" onClick={() => openDetail(p.id)}><Eye size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!detail} wide title={`Detail Pembelian ${detail?.invoice_no || ""}`} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div><span className="text-slate-400">Pemasok:</span> <b className="block">{detail.supplier}</b></div>
              <div><span className="text-slate-400">Tanggal:</span> <b className="block">{formatDateID(detail.purchase_date)}</b></div>
              <div><span className="text-slate-400">Sumber Dana:</span> <b className="block">{detail.funding_source}</b></div>
              <div><span className="text-slate-400">Total:</span> <b className="block text-emerald-700">{rupiah(detail.total_amount)}</b></div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-emerald-800 text-white"><tr><th className="px-3 py-2">Judul</th><th className="px-3 py-2">Jml</th><th className="px-3 py-2">Harga</th><th className="px-3 py-2">Subtotal</th></tr></thead>
              <tbody className="divide-y">
                {(detail.items || []).map((it) => (
                  <tr key={it.id}><td className="px-3 py-2 font-semibold">{it.title}</td><td className="px-3 py-2">{it.quantity}</td><td className="px-3 py-2">{rupiah(it.unit_price)}</td><td className="px-3 py-2 font-bold">{rupiah(it.subtotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ======================================================
// TAB 3: DONASI BUKU (Page 13)
// ======================================================
function DonationsTab({ categories }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ received_date: todayISO(), donor_name: "", donor_type: "Alumni", contact: "", donation_type: "Buku", note: "" });
  const [items, setItems] = useState([{ title: "", category_id: "", quantity: "1", condition_status: "Baik" }]);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    api.get(E.PROCUREMENT.DONATIONS_STATS).then(({ data }) => setStats(data.data)).catch(() => {});
    api.get(E.PROCUREMENT.DONATIONS).then(({ data }) => setRecent(data.data || [])).catch(() => {});
  };
  useEffect(() => { loadData(); }, []);

  const updateRow = (idx, key, val) => setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const totalCopies = items.reduce((a, r) => a + (Number(r.quantity) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.donor_name.trim()) return toast.error("Nama donatur wajib diisi");
    if (!items.some((i) => i.title.trim())) return toast.error("Tambahkan minimal 1 buku donasi");
    setSaving(true);
    try {
      await request((a) => a.post(E.PROCUREMENT.DONATIONS, { ...form, items }), { success: "Data donasi buku tersimpan!" });
      setForm({ received_date: todayISO(), donor_name: "", donor_type: "Alumni", contact: "", donation_type: "Buku", note: "" });
      setItems([{ title: "", category_id: "", quantity: "1", condition_status: "Baik" }]);
      loadData();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    const { data } = await api.get(E.PROCUREMENT.DONATION_DETAIL(id));
    setDetail(data.data);
  };

  return (
    <div className="space-y-5">
      {/* 4 Summary Cards (Page 13) */}
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard icon={Gift} value={stats?.total_trx ?? 0} label="Transaksi Donasi" tone="emerald" loading={!stats} />
        <StatCard icon={BookOpen} value={stats?.total_copies ?? 0} label="Total Eksemplar" tone="teal" loading={!stats} />
        <StatCard icon={Users} value={stats?.total_donors ?? 0} label="Total Donatur" tone="violet" loading={!stats} />
        <StatCard icon={Calendar} value={stats?.last_donation_date ? formatDateID(stats.last_donation_date) : "-"} label="Donasi Terakhir" tone="blue" loading={!stats} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="card xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Plus size={18} className="rounded-full bg-emerald-700 p-0.5 text-white" /> Tambah Donasi Buku
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div><label className="label">Tanggal Penerimaan *</label><input type="date" className="input" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></div>
              <div><label className="label">Nama Donatur *</label><input className="input" required placeholder="Alumni PP Attholibiyah" value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} /></div>
              <div>
                <label className="label">Jenis Donatur</label>
                <select className="input" value={form.donor_type} onChange={(e) => setForm({ ...form, donor_type: e.target.value })}>
                  {["Alumni", "Wali Santri", "Ustadz / Guru", "Lembaga / Instansi", "Hamba Allah"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Kontak (Opsional)</label><input className="input" placeholder="0812-3456-7890" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
              <div>
                <label className="label">Bentuk Donasi</label>
                <select className="input" value={form.donation_type} onChange={(e) => setForm({ ...form, donation_type: e.target.value })}>
                  <option value="Buku">Buku</option>
                  <option value="Kitab Kuning">Kitab Kuning</option>
                  <option value="Majalah / Jurnal">Majalah / Jurnal</option>
                </select>
              </div>
              <div><label className="label">Keterangan</label><input className="input" placeholder="Donasi koleksi keislaman" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-bold">Daftar Buku Donasi</div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-800 text-white">
                    <tr><th className="px-3 py-2">Judul Buku</th><th className="px-3 py-2">Kategori</th><th className="w-24 px-3 py-2">Jumlah</th><th className="w-32 px-3 py-2">Kondisi</th><th className="w-10 px-2 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2"><input className="input !py-1.5 text-xs" placeholder="Judul buku donasi..." value={row.title} onChange={(e) => updateRow(idx, "title", e.target.value)} /></td>
                        <td className="p-2">
                          <select className="input !py-1.5 text-xs" value={row.category_id} onChange={(e) => updateRow(idx, "category_id", e.target.value)}>
                            <option value="">Umum</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><input type="number" min={1} className="input !py-1.5 text-center text-xs font-bold" placeholder="1" value={row.quantity} onChange={(e) => updateRow(idx, "quantity", e.target.value)} /></td>
                        <td className="p-2">
                          <select className="input !py-1.5 text-xs" value={row.condition_status} onChange={(e) => updateRow(idx, "condition_status", e.target.value)}>
                            <option value="Baik">Baik</option>
                            <option value="Kurang Baik">Kurang Baik</option>
                            <option value="Rusak">Rusak</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          {items.length > 1 && <button type="button" className="text-rose-500" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { title: "", category_id: "", quantity: "1", condition_status: "Baik" }])}>
                <Plus size={14} /> Tambah Baris
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 dark:border-slate-700">
              <div className="text-xs">
                Total Judul: <b>{items.filter((i) => i.title.trim()).length} judul</b> · Total Eksemplar: <b className="text-emerald-700">{totalCopies} buku</b>
              </div>
              <button className="btn btn-primary px-6" disabled={saving}><Save size={16} /> {saving ? "Menyimpan..." : "Simpan Donasi"}</button>
            </div>
          </form>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <div className="card">
            <div className="card-header"><span className="font-bold">Informasi Donatur</span></div>
            <div className="space-y-2 p-5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Nama Donatur</span><b>{form.donor_name || "-"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Jenis Donatur</span><b>{form.donor_type}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Kontak</span><b>{form.contact || "-"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Tanggal Donasi</span><b>{formatDateID(form.received_date)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Bentuk Donasi</span><b>{form.donation_type}</b></div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header"><span className="font-bold">Riwayat Donasi Terbaru</span></div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recent.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Belum ada data donasi</div>
              ) : (
                recent.slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{d.donor_name}</div>
                      <div className="text-slate-400">{formatDateID(d.received_date)} · {d.donor_type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-emerald-100 text-emerald-700">{d.total_copies} buku</span>
                      <button className="btn btn-ghost btn-sm !p-1.5" onClick={() => openDetail(d.id)}><Eye size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!detail} wide title={`Detail Donasi — ${detail?.donor_name || ""}`} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div><span className="text-slate-400">Donatur:</span> <b className="block">{detail.donor_name} ({detail.donor_type})</b></div>
              <div><span className="text-slate-400">Tanggal:</span> <b className="block">{formatDateID(detail.received_date)}</b></div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-emerald-800 text-white"><tr><th className="px-3 py-2">Judul Buku</th><th className="px-3 py-2">Jumlah</th><th className="px-3 py-2">Kondisi</th></tr></thead>
              <tbody className="divide-y">
                {(detail.items || []).map((it) => (
                  <tr key={it.id}><td className="px-3 py-2 font-semibold">{it.title}</td><td className="px-3 py-2">{it.quantity}</td><td className="px-3 py-2">{it.condition_status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ======================================================
// TAB 4: RIWAYAT PENGADAAN GABUNGAN
// ======================================================
function HistoryTab() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get(E.PROCUREMENT.HISTORY).then(({ data }) => setRows(data.data || [])).catch(() => {});
  }, []);

  const handleExport = () => {
    exportCSV("riwayat-pengadaan.csv", ["Jenis", "Tanggal", "Pemasok/Donatur", "Referensi", "Eksemplar", "Nominal", "Catatan"],
      rows.map((r) => [r.kind, r.trx_date, r.source_name, r.ref_no, r.total_copies, r.amount, r.note]));
    toast.success("Riwayat pengadaan diekspor");
  };

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <span className="font-bold">Riwayat Pembelian & Donasi Buku</span>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Ekspor CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-emerald-800 text-xs text-white">
            <tr><th className="px-4 py-3">No</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Pemasok / Donatur</th><th className="px-4 py-3">Ref / Kategori</th><th className="px-4 py-3">Eksemplar</th><th className="px-4 py-3">Nominal</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">Belum ada riwayat pengadaan</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">{formatDateID(r.trx_date)}</td>
                  <td className="px-4 py-3"><span className={`badge ${r.kind === "Pembelian" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{r.kind}</span></td>
                  <td className="px-4 py-3 font-bold">{r.source_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.ref_no || "-"}</td>
                  <td className="px-4 py-3 font-bold">{r.total_copies} buku</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">{r.amount ? rupiah(r.amount) : "Gratis (Donasi)"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Procurement() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = TABS.find((t) => location.pathname.includes(t.key))?.key || "rencana";
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get(E.CATEGORIES.LIST, { params: { limit: 100 } }).then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <ShoppingCart size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Pengadaan Buku</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola perencanaan, pembelian, donasi, dan riwayat pengadaan koleksi buku</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, path, label, icon: Icon }) => (
            <button key={key} onClick={() => navigate(path)} className={`btn ${activeKey === key ? "btn-primary shadow-md" : "btn-ghost"}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeKey === "rencana" && <PlansTab categories={categories} />}
      {activeKey === "pembelian" && <PurchasesTab categories={categories} />}
      {activeKey === "donasi" && <DonationsTab categories={categories} />}
      {activeKey === "riwayat" && <HistoryTab />}
    </div>
  );
}
