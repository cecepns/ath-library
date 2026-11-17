import { useEffect, useState } from "react";
import {
  CalendarCheck, Users, Calendar, BarChart3, Trophy, Plus, Camera, Search,
  LogOut, Trash2, CheckCircle2, X, PieChart,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import QrScannerModal from "@/components/QrScannerModal";
import { BarChart, DonutChart } from "@/components/Charts";
import { useList } from "@/hooks/useList";
import { useDebounce } from "@/hooks/useDebounce";
import { api, fileUrl } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast, formatDateID, todayISO } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const PURPOSES = ["Membaca Buku", "Mencari Referensi", "Mengerjakan Tugas", "Meminjam / Mengembalikan", "Lainnya"];
const PURPOSE_COLORS = {
  "Membaca Buku": "#059669",
  "Mencari Referensi": "#22c55e",
  "Mengerjakan Tugas": "#facc15",
  "Meminjam / Mengembalikan": "#38bdf8",
  "Lainnya": "#94a3b8",
};
const PURPOSE_PILL = {
  "Membaca Buku": "bg-emerald-100 text-emerald-800",
  "Mencari Referensi": "bg-sky-100 text-sky-800",
  "Mengerjakan Tugas": "bg-amber-100 text-amber-800",
  "Meminjam / Mengembalikan": "bg-violet-100 text-violet-800",
  "Lainnya": "bg-slate-100 text-slate-700",
};

const nowTime = () => new Date().toTimeString().slice(0, 5);

export default function Visits() {
  const list = useList(E.VISITS.LIST);
  const [period, setPeriod] = useState("month");
  const [stats, setStats] = useState(null);

  // Form state
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [found, setFound] = useState([]);
  const [member, setMember] = useState(null);
  const [visitDate, setVisitDate] = useState(todayISO());
  const [checkIn, setCheckIn] = useState(nowTime());
  const [checkOut, setCheckOut] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleScanMember = async (code) => {
    try {
      const { data } = await api.get(E.MEMBERS.LIST, { params: { search: code, limit: 5, status: "aktif" } });
      const rows = data.data || [];
      const exact = rows.find((m) => m.member_no?.toLowerCase() === code.toLowerCase()) || rows[0];
      if (!exact) return toast.error(`Anggota "${code}" tidak ditemukan`);
      setMember(exact);
      toast.success(`Anggota terpilih: ${exact.name}`);
    } catch {
      toast.error("Gagal mencari data anggota");
    }
  };

  const loadStats = () => {
    api.get(E.VISITS.STATS, { params: { period } }).then(({ data }) => setStats(data.data)).catch(() => {});
  };

  useEffect(() => { loadStats(); }, [period]);

  useEffect(() => {
    if (!dq || member) return setFound([]);
    api.get(E.MEMBERS.LIST, { params: { search: dq, limit: 6, status: "aktif" } })
      .then(({ data }) => setFound(data.data || []))
      .catch(() => {});
  }, [dq, member]);

  const submitVisit = async (e) => {
    e.preventDefault();
    if (!member) return toast.error("Pilih anggota terlebih dahulu");
    setSaving(true);
    try {
      await request(
        (a) => a.post(E.VISITS.LIST, { member_id: member.id, visit_date: visitDate, check_in: checkIn, check_out: checkOut || null, purpose, note }),
        { success: `Kunjungan ${member.name} tercatat` }
      );
      setMember(null);
      setQ("");
      setCheckIn(nowTime());
      setCheckOut("");
      setNote("");
      list.reload();
      loadStats();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (row) => {
    await request((a) => a.put(E.VISITS.CHECKOUT(row.id), { check_out: nowTime() }), { success: "Waktu keluar berhasil dicatat" });
    list.reload();
  };

  const handleDelete = async (row) => {
    if (!(await confirmToast("Hapus catatan kunjungan ini?"))) return;
    await request((a) => a.delete(E.VISITS.DETAIL(row.id)), { success: "Kunjungan dihapus" });
    list.reload();
    loadStats();
  };

  const purposeSegments = (stats?.by_purpose || []).map((p) => ({
    label: p.purpose,
    value: Number(p.total || 0),
    color: PURPOSE_COLORS[p.purpose] || "#10b981",
    showPctOnly: true,
  }));

  return (
    <div className="space-y-5">
      {/* Header (Page 9) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <CalendarCheck size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Kunjungan Perpustakaan</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Catat dan kelola data kunjungan anggota ke perpustakaan</p>
          </div>
        </div>
        <button
          className="btn btn-primary self-start sm:self-auto"
          onClick={() => setCameraOpen(true)}
        >
          <Camera size={17} /> Scan Kartu / QR Kamera
        </button>
      </div>

      {/* 5 Summary Stat Cards (Page 9) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Users} value={stats?.today_count ?? 0} label="Kunjungan Hari Ini" tone="emerald" loading={!stats} />
        <StatCard icon={Calendar} value={stats?.month_count ?? 0} label="Kunjungan Bulan Ini" tone="teal" loading={!stats} />
        <StatCard icon={BarChart3} value={stats?.year_count ?? 0} label="Kunjungan Tahun Ini" tone="blue" loading={!stats} />
        <StatCard icon={Users} value={stats?.total_members ?? 0} label="Total Anggota Aktif" tone="violet" loading={!stats} />
        <StatCard
          icon={Trophy}
          value={stats?.top_room?.room || "-"}
          label="Kamar Teraktif"
          subtitle={`${stats?.top_room?.total || 0} kunjungan`}
          tone="amber"
          loading={!stats}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left: Form Kunjungan Baru + Table */}
        <div className="space-y-5 xl:col-span-8">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Plus size={18} className="rounded-full bg-emerald-700 p-0.5 text-white" /> Kunjungan Baru
              </div>
            </div>
            <form onSubmit={submitVisit} className="space-y-4 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                {/* 1. Pilih Anggota */}
                <div className="space-y-2.5">
                  <div className="text-sm font-bold">1. Pilih Anggota</div>
                  {member ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-3">
                        {member.photo ? (
                          <img src={fileUrl(member.photo)} alt={member.name} className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-sm font-extrabold text-white">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{member.name}</div>
                          <span className="badge bg-emerald-700 text-white font-mono">{member.member_no}</span>
                          <div className="mt-0.5 text-xs text-slate-500">{member.level || "-"} · Kamar {member.room || "-"}</div>
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMember(null); setQ(""); }}>Ganti</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            id="visit-member-input"
                            className="input pl-10"
                            placeholder="Cari nama, kamar, atau scan kartu/QR..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                          />
                        </div>
                        <button type="button" onClick={() => setCameraOpen(true)} className="btn btn-primary !px-3" title="Scan Kartu Anggota via Kamera">
                          <Camera size={17} />
                        </button>
                      </div>
                      {found.length > 0 && (
                        <ul className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                          {found.map((m) => (
                            <li
                              key={m.id}
                              onClick={() => { setMember(m); setFound([]); }}
                              className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-slate-700"
                            >
                              <span><b>{m.name}</b> <span className="text-xs text-slate-400">({m.member_no})</span></span>
                              <span className="text-xs text-emerald-700">{m.room || "-"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Detail Kunjungan */}
                <div className="space-y-3">
                  <div className="text-sm font-bold">2. Detail Kunjungan</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Tanggal</label>
                      <input type="date" className="input !px-2 text-xs" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Waktu Masuk</label>
                      <input type="time" className="input !px-2 text-xs" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Waktu Keluar</label>
                      <input type="time" className="input !px-2 text-xs" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Keperluan</label>
                    <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                      {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Keterangan (Opsional)</label>
                    <input className="input" placeholder="Contoh: mencari referensi tugas..." value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button className="btn btn-primary px-6" disabled={saving}>
                  <CheckCircle2 size={17} /> {saving ? "Menyimpan..." : "Simpan Kunjungan"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setMember(null); setQ(""); setNote(""); setCheckOut(""); }}>
                  <X size={16} /> Bersihkan
                </button>
              </div>
            </form>
          </div>

          <DataTable
            list={list}
            placeholder="Cari riwayat kunjungan (nama, kamar, keperluan)..."
            columns={[
              { label: "Tanggal", render: (r) => formatDateID(r.visit_date) },
              { label: "Masuk", render: (r) => <span className="font-mono text-xs font-bold text-emerald-700">{String(r.check_in || "").slice(0, 5)}</span> },
              { label: "Keluar", render: (r) => (r.check_out ? <span className="font-mono text-xs">{String(r.check_out).slice(0, 5)}</span> : <span className="text-xs italic text-amber-600">Di ruang baca</span>) },
              { label: "Anggota", render: (r) => <b>{r.member_name} <span className="text-xs font-normal text-slate-400">({r.member_no})</span></b> },
              { label: "Jenjang", render: (r) => r.member_level || "-" },
              { label: "Kamar", render: (r) => r.member_room || "-" },
              { label: "Keperluan", render: (r) => <span className={`badge ${PURPOSE_PILL[r.purpose] || "bg-slate-100 text-slate-700"}`}>{r.purpose}</span> },
            ]}
            actions={(r) => (
              <>
                {!r.check_out && (
                  <button className="btn btn-secondary btn-sm !px-2" title="Catat Keluar" onClick={() => handleCheckout(r)}>
                    <LogOut size={14} /> Keluar
                  </button>
                )}
                <button className="btn btn-danger btn-sm !px-2" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
              </>
            )}
          />
        </div>

        {/* Right: Charts */}
        <div className="space-y-5 xl:col-span-4">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <BarChart3 size={18} className="text-emerald-700" /> Statistik Kunjungan
              </div>
              <select
                className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="month">Bulan Ini</option>
                <option value="year">Tahun Ini</option>
              </select>
            </div>
            <div className="p-5">
              <BarChart data={stats?.series || []} height={195} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <PieChart size={18} className="text-emerald-700" /> Kunjungan Berdasarkan Keperluan
              </div>
            </div>
            <div className="p-5">
              <DonutChart
                centerValue={period === "year" ? stats?.year_count ?? 0 : stats?.month_count ?? 0}
                centerLabel="Kunjungan"
                segments={purposeSegments}
              />
            </div>
          </div>
        </div>
      </div>
      <QrScannerModal
        open={cameraOpen}
        title="Scan Kartu / QR Anggota"
        subtitle="Arahkan kamera ke kode QR / barcode kartu anggota perpustakaan"
        onScan={handleScanMember}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}
