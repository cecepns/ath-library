import { useEffect, useRef, useState } from "react";
import {
  Settings as SettingsIcon, Users, CalendarClock, Database, Save, RotateCcw,
  Upload, Sun, Moon, Plus, Pencil, Trash2, Download, Building2, Sliders, Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import BrandLogo from "@/components/BrandLogo";
import Modal from "@/components/Modal";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast, rupiah } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const TABS = [
  { key: "umum", label: "Pengaturan Umum", icon: SettingsIcon },
  { key: "pengguna", label: "Pengguna & Hak Akses", icon: Users },
  { key: "aturan", label: "Aturan Peminjaman & Denda", icon: CalendarClock },
  { key: "backup", label: "Backup & Restore", icon: Database },
];

export default function Settings() {
  const { user, reloadSettings, updateLocalSettings } = useAuth();
  const isAdmin = user?.role === "administrator";
  const logoRef = useRef(null);
  const restoreRef = useRef(null);

  const [tab, setTab] = useState("umum");
  const [form, setForm] = useState({});
  const [summary, setSummary] = useState({ total_categories: 0, total_shelves: 0, total_users: 0 });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  // User CRUD modal
  const [uModal, setUModal] = useState(null);
  const [uForm, setUForm] = useState({ name: "", username: "", password: "", role: "petugas", status: "aktif" });

  const loadAll = async () => {
    try {
      const [{ data: sRes }, { data: uRes }] = await Promise.all([api.get(E.SETTINGS.GET), api.get(E.USERS.LIST)]);
      setForm(sRes.data.settings || {});
      setSummary(sRes.data.summary || {});
      setUsers(uRes.data || []);
    } catch { /* noop */ }
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await request((a) => a.put(E.SETTINGS.UPDATE, form), { success: "Pengaturan berhasil disimpan!" });
      updateLocalSettings(res.data);
      await reloadSettings();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!(await confirmToast("Kembalikan seluruh pengaturan ke nilai default?"))) return;
    const res = await request((a) => a.post(E.SETTINGS.RESET), { success: "Pengaturan dikembalikan ke default" });
    setForm(res.data);
    updateLocalSettings(res.data);
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    const res = await request((a) => a.post(E.SETTINGS.LOGO, fd), { success: "Logo perpustakaan diperbarui" });
    setForm((f) => ({ ...f, logo: res.logo }));
    updateLocalSettings({ logo: res.logo });
  };

  const openUserModal = (row = null) => {
    setUForm(row ? { name: row.name, username: row.username, password: "", role: row.role, status: row.status } : { name: "", username: "", password: "", role: "petugas", status: "aktif" });
    setUModal({ row });
  };

  const saveUser = async (e) => {
    e.preventDefault();
    await request(
      (a) => (uModal.row ? a.put(E.USERS.DETAIL(uModal.row.id), uForm) : a.post(E.USERS.LIST, uForm)),
      { success: "Data pengguna tersimpan" }
    );
    setUModal(null);
    loadAll();
  };

  const deleteUser = async (row) => {
    if (!(await confirmToast(`Hapus pengguna "${row.name}"?`))) return;
    await request((a) => a.delete(E.USERS.DETAIL(row.id)), { success: "Pengguna dihapus" });
    loadAll();
  };

  const downloadBackup = async () => {
    const { data } = await request((a) => a.get(E.SETTINGS.BACKUP), { success: "Backup berhasil diunduh" });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ath-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      await request((a) => a.post(E.SETTINGS.RESTORE, json), { success: "Konfigurasi berhasil dipulihkan!" });
      loadAll();
      reloadSettings();
    } catch {
      toast.error("File backup JSON tidak valid");
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 14) */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <SettingsIcon size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Pengaturan</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola konfigurasi identitas, pengguna, aturan peminjaman, dan backup sistem</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? "btn-primary shadow-md" : "btn-ghost"}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: PENGATURAN UMUM */}
      {tab === "umum" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-12">
            {/* Left: Identitas Perpustakaan + Informasi Petugas Aktif */}
            <div className="space-y-5 xl:col-span-7">
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2 font-bold"><Building2 size={18} className="text-emerald-700" /> Identitas Perpustakaan</div>
                </div>
                <div className="grid gap-5 p-5 sm:grid-cols-12">
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center sm:col-span-4 dark:border-slate-700 dark:bg-slate-900">
                    <BrandLogo size={82} logoFile={form.logo} />
                    <div className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300">{form.app_title || "ATH LIBRARY"}</div>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadLogo} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => logoRef.current?.click()}>
                      <Upload size={14} /> Ubah Logo
                    </button>
                  </div>
                  <div className="space-y-3 sm:col-span-8">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="label">Judul Aplikasi</label><input className="input" value={form.app_title || ""} onChange={(e) => setForm({ ...form, app_title: e.target.value })} /></div>
                      <div><label className="label">Nama Perpustakaan *</label><input className="input" value={form.library_name || ""} onChange={(e) => setForm({ ...form, library_name: e.target.value })} /></div>
                    </div>
                    <div><label className="label">Nama Lembaga *</label><input className="input" value={form.institution_name || ""} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} /></div>
                    <div><label className="label">Alamat</label><input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="label">Kontak / WhatsApp</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                      <div><label className="label">Email</label><input className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informasi Petugas Aktif */}
              <div className="card overflow-hidden">
                <div className="card-header">
                  <div className="flex items-center gap-2 font-bold"><Users size={18} className="text-emerald-700" /> Informasi Petugas Aktif</div>
                  {isAdmin && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setTab("pengguna")}>Kelola Akun</button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-800 text-white">
                      <tr><th className="px-4 py-2.5">No</th><th className="px-4 py-2.5">Nama</th><th className="px-4 py-2.5">Username</th><th className="px-4 py-2.5">Peran</th><th className="px-4 py-2.5">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {users.map((u, i) => (
                        <tr key={u.id}>
                          <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-bold">{u.name}</td>
                          <td className="px-4 py-2.5 font-mono">{u.username}</td>
                          <td className="px-4 py-2.5"><span className={`badge ${u.role === "administrator" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{u.role === "administrator" ? "Administrator" : "Petugas"}</span></td>
                          <td className="px-4 py-2.5"><span className={`badge ${u.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{u.status === "aktif" ? "Aktif" : "Nonaktif"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Pengaturan Sistem + Ringkasan Konfigurasi */}
            <div className="space-y-5 xl:col-span-5">
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2 font-bold"><Sliders size={18} className="text-emerald-700" /> Pengaturan Sistem</div>
                </div>
                <div className="space-y-4 p-5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Tampilan Sistem</span>
                    <select className="input w-48" value={form.theme || "Hijau (Default)"} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
                      <option value="Hijau (Default)">Hijau (Default)</option>
                      <option value="Emerald Klasik">Emerald Klasik</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Bahasa</span>
                    <select className="input w-48" value={form.language || "Indonesia"} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                      <option value="Indonesia">Indonesia</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Mode Tampilan</span>
                    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => { setForm({ ...form, mode: "light" }); updateLocalSettings({ mode: "light" }); }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${form.mode !== "dark" ? "bg-emerald-700 text-white" : "text-slate-500"}`}
                      >
                        <Sun size={14} /> Terang
                      </button>
                      <button
                        type="button"
                        onClick={() => { setForm({ ...form, mode: "dark" }); updateLocalSettings({ mode: "dark" }); }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${form.mode === "dark" ? "bg-emerald-700 text-white" : "text-slate-500"}`}
                      >
                        <Moon size={14} /> Gelap
                      </button>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="font-semibold">Notifikasi Keterlambatan</span>
                    <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={form.notifications !== "false"} onChange={(e) => setForm({ ...form, notifications: String(e.target.checked) })} />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="font-semibold">Login Otomatis (Remember Me)</span>
                    <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={form.remember_me !== "false"} onChange={(e) => setForm({ ...form, remember_me: String(e.target.checked) })} />
                  </label>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="font-bold">Ringkasan Konfigurasi</span></div>
                <div className="space-y-2.5 p-5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Total Kategori Buku</span><b>{summary.total_categories} kategori</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total Rak Buku</span><b>{summary.total_shelves} rak</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Masa Peminjaman</span><b>{form.loan_days || 14} hari</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Biaya Peminjaman</span><b>{rupiah(form.loan_fee || 2000)} / buku</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Denda Keterlambatan</span><b>{rupiah(form.fine_per_day || 2000)} / hari / buku</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total Pengguna</span><b>{summary.total_users} akun</b></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary px-6" disabled={saving} onClick={saveSettings}>
              <Save size={17} /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            {isAdmin && (
              <button className="btn btn-ghost" onClick={resetDefaults}>
                <RotateCcw size={16} /> Reset ke Default
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENGGUNA & HAK AKSES */}
      {tab === "pengguna" && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold"><Shield size={18} className="text-emerald-700" /> Manajemen Pengguna & Hak Akses</div>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => openUserModal()}><Plus size={15} /> Tambah Pengguna</button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-800 text-xs text-white">
                <tr><th className="px-4 py-3">No</th><th className="px-4 py-3">Nama Lengkap</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Status</th>{isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {users.map((u, i) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-bold">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3"><span className={`badge ${u.role === "administrator" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{u.role === "administrator" ? "Administrator" : "Petugas"}</span></td>
                    <td className="px-4 py-3"><span className={`badge ${u.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{u.status === "aktif" ? "Aktif" : "Tidak Aktif"}</span></td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn btn-primary btn-sm !px-2" onClick={() => openUserModal(u)}><Pencil size={14} /></button>
                          <button className="btn btn-danger btn-sm !px-2" onClick={() => deleteUser(u)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ATURAN PEMINJAMAN & DENDA */}
      {tab === "aturan" && (
        <div className="card max-w-2xl">
          <div className="card-header"><span className="font-bold">Aturan Peminjaman & Denda Keterlambatan</span></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div><label className="label">Maksimal Buku per Peminjaman</label><input type="number" min={1} max={10} className="input" placeholder="3" value={form.max_books ?? ""} onChange={(e) => setForm({ ...form, max_books: e.target.value })} /></div>
            <div><label className="label">Lama Peminjaman Default (Hari)</label><input type="number" min={1} max={60} className="input" placeholder="14" value={form.loan_days ?? ""} onChange={(e) => setForm({ ...form, loan_days: e.target.value })} /></div>
            <div><label className="label">Biaya Peminjaman per Buku (Rp)</label><input type="number" min={0} className="input" placeholder="2000" value={form.loan_fee ?? ""} onChange={(e) => setForm({ ...form, loan_fee: e.target.value })} /></div>
            <div><label className="label">Denda Keterlambatan / Hari / Buku (Rp)</label><input type="number" min={0} className="input" placeholder="2000" value={form.fine_per_day ?? ""} onChange={(e) => setForm({ ...form, fine_per_day: e.target.value })} /></div>
            <div><label className="label">Maksimal Jumlah Perpanjangan</label><input type="number" min={0} max={5} className="input" placeholder="1" value={form.max_extend ?? ""} onChange={(e) => setForm({ ...form, max_extend: e.target.value })} /></div>
            <div><label className="label">Durasi Perpanjangan Default (Hari)</label><input type="number" min={1} max={30} className="input" placeholder="7" value={form.extend_days ?? ""} onChange={(e) => setForm({ ...form, extend_days: e.target.value })} /></div>
            <div className="sm:col-span-2 pt-2">
              <button className="btn btn-primary px-6" disabled={saving} onClick={saveSettings}><Save size={16} /> Simpan Aturan</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BACKUP & RESTORE */}
      {tab === "backup" && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-6 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Download size={24} /></div>
            <h3 className="text-lg font-extrabold">Backup Data Perpustakaan</h3>
            <p className="text-xs leading-relaxed text-slate-500">Unduh salinan lengkap seluruh data katalog buku, anggota, transaksi, kunjungan, pengadaan, dan pengaturan dalam format JSON.</p>
            <button className="btn btn-primary" disabled={!isAdmin} onClick={downloadBackup}><Download size={16} /> Unduh Backup JSON</button>
            {!isAdmin && <p className="text-xs text-amber-600">Hanya Administrator yang dapat melakukan backup.</p>}
          </div>
          <div className="card p-6 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Upload size={24} /></div>
            <h3 className="text-lg font-extrabold">Restore Konfigurasi</h3>
            <p className="text-xs leading-relaxed text-slate-500">Pulihkan konfigurasi sistem dari file backup JSON yang sebelumnya diunduh dari ATH Library.</p>
            <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
            <button className="btn btn-secondary" disabled={!isAdmin} onClick={() => restoreRef.current?.click()}><Upload size={16} /> Pilih File Backup (.json)</button>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      <Modal open={!!uModal} title={uModal?.row ? "Edit Pengguna" : "Tambah Pengguna Baru"} onClose={() => setUModal(null)}>
        <form onSubmit={saveUser} className="space-y-4">
          <div><label className="label">Nama Lengkap *</label><input className="input" required value={uForm.name} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} /></div>
          <div><label className="label">Username *</label><input className="input" required value={uForm.username} onChange={(e) => setUForm({ ...uForm, username: e.target.value })} /></div>
          <div><label className="label">Password {uModal?.row ? "(kosongkan jika tidak diubah)" : "*"}</label><input type="password" className="input" required={!uModal?.row} minLength={6} value={uForm.password} onChange={(e) => setUForm({ ...uForm, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Peran</label>
              <select className="input" value={uForm.role} onChange={(e) => setUForm({ ...uForm, role: e.target.value })}>
                <option value="petugas">Petugas</option>
                <option value="administrator">Administrator</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={uForm.status} onChange={(e) => setUForm({ ...uForm, status: e.target.value })}>
                <option value="aktif">Aktif</option>
                <option value="tidak_aktif">Tidak Aktif</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setUModal(null)}>Batal</button>
            <button className="btn btn-primary">Simpan Pengguna</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
