import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users, GraduationCap, UserCheck, Briefcase, CheckCircle2, UserX,
  Plus, Upload, CreditCard, Download, Eye, Pencil, Trash2, RotateCcw,
  Info, Calendar, BedDouble, School, Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import BrandLogo from "@/components/BrandLogo";
import { useList } from "@/hooks/useList";
import { useAuth } from "@/context/AuthContext";
import { api, fileUrl } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast, formatDateID, rupiah } from "@/utils/confirm";
import { exportCSV, parseCSV } from "@/utils/csv";
import { makeQrDataUrl } from "@/utils/qr";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const ROOMS = ["Asatidz", "Pengurus 1", "Pengurus 2", "Pskestren", "Abu Bakar", "Umar", "Utsman", "Ali", "Bilal", "Hamzah", "Hasan", "Husein", "Tahfid", "A1", "A2", "B1", "B2", "C1", "C2"];
const LEVELS = ["MI", "MTs", "SMK", "Aliyah", "Kuliah", "Salaf", "Asatidz", "Staf"];
const TYPES = [
  { value: "santri", label: "Santri" },
  { value: "ustadz", label: "Asatidz / Ustadz" },
  { value: "pengurus", label: "Staf & Pengurus" },
];

const EMPTY = {
  name: "",
  member_no: "",
  entry_year: new Date().getFullYear(),
  room: "",
  level: "MTs",
  type: "santri",
  status: "aktif",
  phone: "",
  address: "",
};

function Avatar({ member, size = "md" }) {
  const cls = size === "lg" ? "h-20 w-20 text-2xl rounded-2xl" : "h-9 w-9 text-xs rounded-full";
  if (member?.photo) {
    return <img src={fileUrl(member.photo)} alt={member.name} className={`${cls} object-cover ring-2 ring-emerald-100`} />;
  }
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-800 font-extrabold text-white shadow-sm`}>
      {(member?.name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Members() {
  const { settings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef(null);
  const [filters, setFilters] = useState({ level: "", room: "", status: "" });
  const list = useList(E.MEMBERS.LIST, filters);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState("loans");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cardModal, setCardModal] = useState(null);
  const [cardQr, setCardQr] = useState("");

  useEffect(() => {
    if (!cardModal?.member_no) { setCardQr(""); return; }
    makeQrDataUrl(cardModal.member_no, 180).then(setCardQr);
  }, [cardModal]);

  const loadStats = () => {
    api.get(E.MEMBERS.STATS).then(({ data }) => setStats(data.data)).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      openForm();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedId && list.data.length > 0) setSelectedId(list.data[0].id);
  }, [list.data, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    api.get(E.MEMBERS.FULL_DETAIL(selectedId)).then(({ data }) => setDetail(data.data)).catch(() => {});
  }, [selectedId]);

  const openForm = (row = null) => {
    setForm(
      row
        ? {
            name: row.name || "",
            member_no: row.member_no || "",
            entry_year: row.entry_year || new Date().getFullYear(),
            room: row.room || "",
            level: row.level || "",
            type: row.type || "santri",
            status: row.status || "aktif",
            phone: row.phone || "",
            address: row.address || "",
          }
        : { ...EMPTY, member_no: `ATH-${String(1001 + Number(stats?.total || 0))}` }
    );
    setPhotoFile(null);
    setModal({ row });
  };

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== "" && v !== null) fd.append(k, v); });
    if (photoFile) fd.append("photo", photoFile);
    setSaving(true);
    try {
      await request(
        (a) => (modal.row ? a.put(E.MEMBERS.DETAIL(modal.row.id), fd) : a.post(E.MEMBERS.LIST, fd)),
        { success: "Data anggota berhasil disimpan" }
      );
      setModal(null);
      list.reload();
      loadStats();
      if (selectedId) api.get(E.MEMBERS.FULL_DETAIL(selectedId)).then(({ data }) => setDetail(data.data)).catch(() => {});
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!(await confirmToast(`Hapus data anggota "${row.name}"?`))) return;
    await request((a) => a.delete(E.MEMBERS.DETAIL(row.id)), { success: "Anggota dihapus" });
    if (selectedId === row.id) { setSelectedId(null); setDetail(null); }
    list.reload();
    loadStats();
  };

  const handleExport = () => {
    const headers = ["No. Anggota", "Nama", "Jenjang", "Kamar", "Tahun Masuk", "Jenis", "Status", "Kontak"];
    const rows = list.data.map((m) => [m.member_no, m.name, m.level, m.room, m.entry_year, m.type, m.status, m.phone]);
    exportCSV("data-anggota-ath-library.csv", headers, rows);
    toast.success("Data anggota diekspor ke CSV");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rows = parseCSV(await file.text());
    if (!rows.length) return toast.error("CSV kosong (butuh kolom: name,member_no,entry_year,room,level,type)");
    await request((a) => a.post(E.MEMBERS.IMPORT, { rows }), { success: "Impor anggota selesai" });
    e.target.value = "";
    list.reload();
    loadStats();
  };

  const printCard = async (m) => {
    const qrUrl = cardQr || (await makeQrDataUrl(m.member_no, 180));
    const w = window.open("", "_blank", "width=520,height=380");
    w.document.write(`
      <div style="font-family:sans-serif;width:390px;margin:24px auto;border-radius:16px;overflow:hidden;border:2px solid #065f46;box-shadow:0 8px 20px rgba(0,0,0,.1);">
        <div style="background:linear-gradient(135deg,#065f46,#047857);color:#fff;padding:14px 18px;">
          <div style="font-size:16px;font-weight:800;">${settings.app_title || "ATH LIBRARY"}</div>
          <div style="font-size:11px;opacity:.85;">Kartu Anggota ${settings.library_name || "Perpustakaan Attholibiyah"}</div>
        </div>
        <div style="padding:18px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:800;color:#064e3b;">${m.name}</div>
            <div style="display:inline-block;margin-top:4px;background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;">${m.member_no}</div>
            <table style="margin-top:10px;font-size:12px;color:#334155;width:100%;">
              <tr><td style="padding:2px 0;color:#64748b;">Jenjang</td><td><b>${m.level || "-"}</b></td></tr>
              <tr><td style="padding:2px 0;color:#64748b;">Kamar</td><td><b>${m.room || "-"}</b></td></tr>
              <tr><td style="padding:2px 0;color:#64748b;">Jenis</td><td style="text-transform:capitalize;"><b>${m.type}</b></td></tr>
              <tr><td style="padding:2px 0;color:#64748b;">Masuk</td><td><b>${m.entry_year}</b></td></tr>
            </table>
          </div>
          ${qrUrl ? `<div style="text-align:center;"><img src="${qrUrl}" style="width:92px;height:92px;border:1px solid #d1fae5;border-radius:8px;padding:3px;" /><div style="font-size:9px;color:#64748b;margin-top:2px;">Scan QR</div></div>` : ""}
        </div>
      </div>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 6) */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Data Anggota</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola data anggota perpustakaan (santri, asatidz, dan staf)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={() => openForm()}>
            <Plus size={17} /> Tambah Anggota
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Impor CSV
          </button>
          <button className="btn btn-ghost" onClick={() => detail?.member ? setCardModal(detail.member) : toast.error("Pilih anggota dulu")}>
            <CreditCard size={16} /> Cetak Kartu
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={16} /> Ekspor
          </button>
        </div>
      </div>

      {/* 6 Summary Stat Cards (Page 6) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} value={stats?.total ?? 0} label="Total Anggota" tone="emerald" loading={!stats} />
        <StatCard icon={GraduationCap} value={stats?.santri ?? 0} label="Santri" tone="teal" loading={!stats} />
        <StatCard icon={UserCheck} value={stats?.ustadz ?? 0} label="Asatidz/Ustadz" tone="blue" loading={!stats} />
        <StatCard icon={Briefcase} value={stats?.pengurus ?? 0} label="Staf & Pengurus" tone="violet" loading={!stats} />
        <StatCard icon={CheckCircle2} value={stats?.active ?? 0} label="Anggota Aktif" tone="emerald" loading={!stats} />
        <StatCard icon={UserX} value={stats?.inactive ?? 0} label="Tidak Aktif" tone="rose" loading={!stats} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left: Table */}
        <div className="xl:col-span-8">
          <DataTable
            list={list}
            placeholder="Cari nama, kamar, atau no. anggota..."
            onRowClick={(r) => setSelectedId(r.id)}
            selectedRowId={selectedId}
            filters={
              <>
                <select className="input w-36" value={filters.level} onChange={(e) => { setFilters((f) => ({ ...f, level: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}>
                  <option value="">Semua Jenjang</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select className="input w-36" value={filters.room} onChange={(e) => { setFilters((f) => ({ ...f, room: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}>
                  <option value="">Semua Kamar</option>
                  {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select className="input w-36" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}>
                  <option value="">Semua Status</option>
                  <option value="aktif">Aktif</option>
                  <option value="tidak_aktif">Tidak Aktif</option>
                </select>
                <button className="btn btn-ghost btn-sm py-2.5" onClick={() => { setFilters({ level: "", room: "", status: "" }); list.setParams((p) => ({ ...p, search: "", page: 1 })); }}>
                  <RotateCcw size={15} /> Reset
                </button>
              </>
            }
            columns={[
              { label: "Foto", render: (r) => <Avatar member={r} /> },
              { label: "No. Anggota", render: (r) => <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-300">{r.member_no}</span> },
              { label: "Nama Lengkap", render: (r) => <span className="font-bold text-slate-800 dark:text-white">{r.name}</span> },
              { label: "Jenjang", render: (r) => <span className="badge bg-sky-100 text-sky-800">{r.level || "-"}</span> },
              { label: "Kamar", render: (r) => r.room || "-" },
              {
                label: "Status",
                render: (r) => (
                  <span className={`badge ${r.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {r.status === "aktif" ? "Aktif" : "Tidak Aktif"}
                  </span>
                ),
              },
            ]}
            actions={(r) => (
              <>
                <button className="btn btn-ghost btn-sm !px-2" title="Detail" onClick={() => setSelectedId(r.id)}><Eye size={14} /></button>
                <button className="btn btn-primary btn-sm !px-2" title="Edit" onClick={() => openForm(r)}><Pencil size={14} /></button>
                <button className="btn btn-danger btn-sm !px-2" title="Hapus" onClick={() => remove(r)}><Trash2 size={14} /></button>
              </>
            )}
          />
        </div>

        {/* Right: Detail Anggota Panel (Page 6) */}
        <div className="xl:col-span-4">
          <div className="card sticky top-20 overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Info size={18} className="text-emerald-700" /> Detail Anggota
              </div>
              {detail?.member && (
                <button className="btn btn-secondary btn-sm" onClick={() => setCardModal(detail.member)}>
                  <CreditCard size={14} /> Kartu
                </button>
              )}
            </div>
            {detail?.member ? (
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-4">
                  <Avatar member={detail.member} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-base font-extrabold text-slate-900 dark:text-white">{detail.member.name}</h4>
                      <span className={`badge ${detail.member.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {detail.member.status === "aktif" ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <span className="mt-1 inline-block rounded-lg bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                      {detail.member.member_no}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2"><School size={13} className="text-emerald-700" /> Jenjang: <b>{detail.member.level || "-"}</b></div>
                      <div className="flex items-center gap-2"><BedDouble size={13} className="text-emerald-700" /> Kamar: <b>{detail.member.room || "-"}</b></div>
                      <div className="flex items-center gap-2"><Calendar size={13} className="text-emerald-700" /> Masuk: <b>{detail.member.entry_year}</b> · <span className="capitalize">{detail.member.type}</span></div>
                    </div>
                  </div>
                </div>

                {/* 3 Sub-tabs matching Page 6 */}
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold dark:bg-slate-900">
                  {[
                    ["loans", "Peminjaman"],
                    ["payments", "Pembayaran"],
                    ["info", "Data Lengkap"],
                  ].map(([k, lbl]) => (
                    <button
                      key={k}
                      onClick={() => setDetailTab(k)}
                      className={`rounded-lg py-2 transition ${detailTab === k ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:text-emerald-800 dark:text-slate-300"}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {detailTab === "loans" && (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-800 text-white">
                        <tr>
                          <th className="px-3 py-2">Judul Buku</th>
                          <th className="px-3 py-2">Pinjam</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {detail.loans.length === 0 ? (
                          <tr><td colSpan={3} className="p-5 text-center text-slate-400">Belum ada riwayat peminjaman</td></tr>
                        ) : (
                          detail.loans.map((l) => (
                            <tr key={l.id}>
                              <td className="max-w-[140px] truncate px-3 py-2 font-medium" title={l.titles}>{l.titles}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDateID(l.loan_date)}</td>
                              <td className="px-3 py-2">
                                <span className={`badge ${l.display_status === "returned" ? "bg-emerald-100 text-emerald-700" : l.display_status === "overdue" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                                  {l.display_status === "returned" ? "Kembali" : l.display_status === "overdue" ? "Terlambat" : "Dipinjam"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {detailTab === "payments" && (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {detail.payments.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">Belum ada riwayat pembayaran</p>
                    ) : (
                      detail.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-700">
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white">{p.trx_no}</div>
                            <div className="text-slate-400">{formatDateID(p.loan_date)} · {p.payment_method || "Tunai"}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-800 dark:text-emerald-300">{rupiah(Number(p.fee) + Number(p.fine))}</div>
                            <span className={`badge ${p.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                              {p.paid ? "Lunas" : "Belum Bayar"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {detailTab === "info" && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-slate-900">
                    <div className="flex justify-between"><span className="text-slate-400">No. Anggota</span><b>{detail.member.member_no}</b></div>
                    <div className="flex justify-between"><span className="text-slate-400">Jenis Anggota</span><b className="capitalize">{detail.member.type}</b></div>
                    <div className="flex justify-between"><span className="text-slate-400">Tahun Masuk</span><b>{detail.member.entry_year}</b></div>
                    <div className="flex justify-between"><span className="text-slate-400">No. HP / Kontak</span><b>{detail.member.phone || "-"}</b></div>
                    <div className="flex justify-between"><span className="text-slate-400">Alamat</span><b className="text-right">{detail.member.address || "-"}</b></div>
                    <div className="flex justify-between"><span className="text-slate-400">Terdaftar</span><b>{formatDateID(detail.member.created_at)}</b></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">Pilih anggota dari tabel untuk melihat detail.</div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Member Modal */}
      <Modal open={!!modal} wide title={modal?.row ? "Edit Data Anggota" : "Tambah Anggota Baru"} onClose={() => setModal(null)}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nama Lengkap *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">No. Anggota *</label>
            <input className="input font-mono" required value={form.member_no} onChange={(e) => setForm({ ...form, member_no: e.target.value })} />
          </div>
          <div>
            <label className="label">Tahun Masuk Pesantren *</label>
            <input type="number" className="input" required value={form.entry_year} onChange={(e) => setForm({ ...form, entry_year: e.target.value })} />
          </div>
          <div>
            <label className="label">Jenis Anggota</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Jenjang</label>
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="">Pilih jenjang...</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Kamar</label>
            <select className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
              <option value="">- / Tanpa Kamar</option>
              {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">No. HP / Kontak</label>
            <input className="input" placeholder="0812-xxxx-xxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="aktif">Aktif</option>
              <option value="tidak_aktif">Tidak Aktif</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Foto Anggota (JPG/PNG, maks 2MB)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="input" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Alamat (opsional)</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Anggota"}</button>
          </div>
        </form>
      </Modal>

      {/* Member Card Preview Modal */}
      <Modal open={!!cardModal} title="Pratinjau Kartu Anggota" onClose={() => setCardModal(null)}>
        {cardModal && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border-2 border-emerald-800 shadow-lg">
              <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-800 to-emerald-700 p-4 text-white">
                <BrandLogo size={42} logoFile={settings.logo} />
                <div>
                  <div className="font-extrabold">{settings.app_title || "ATH LIBRARY"}</div>
                  <div className="text-[11px] text-emerald-100">Kartu Anggota {settings.library_name}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 bg-white p-5 dark:bg-slate-800">
                <div className="flex items-center gap-3.5">
                  <Avatar member={cardModal} size="lg" />
                  <div className="text-xs space-y-1">
                    <div className="text-base font-extrabold text-emerald-950 dark:text-white">{cardModal.name}</div>
                    <span className="badge bg-emerald-100 text-emerald-800 font-mono">{cardModal.member_no}</span>
                    <div className="pt-1 text-slate-600 dark:text-slate-300">Jenjang: <b>{cardModal.level || "-"}</b> · Kamar: <b>{cardModal.room || "-"}</b></div>
                    <div className="text-slate-500 capitalize">Jenis: <b>{cardModal.type}</b> · Masuk: <b>{cardModal.entry_year}</b></div>
                  </div>
                </div>
                {cardQr && <img src={cardQr} alt="QR Anggota" className="h-20 w-20 shrink-0 rounded-xl border border-emerald-200 bg-white p-1" />}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setCardModal(null)}>Tutup</button>
              <button className="btn btn-primary" onClick={() => printCard(cardModal)}><Printer size={16} /> Cetak Kartu</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
