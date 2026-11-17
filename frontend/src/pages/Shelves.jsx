import { useEffect, useState } from "react";
import {
  Library, Layers, BookOpen, BookMarked, Box, Plus, Pencil, Trash2, Info, BarChart3, RotateCcw,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { HorizontalBarList } from "@/components/Charts";
import { useList } from "@/hooks/useList";
import { api } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

export default function Shelves() {
  const [filters, setFilters] = useState({ category_id: "", sortBy: "code" });
  const list = useList(E.SHELVES.LIST, filters);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", category_id: "" });
  const [saving, setSaving] = useState(false);

  const loadStats = () => {
    api.get(E.SHELVES.STATS).then(({ data }) => setStats(data.data)).catch(() => {});
  };

  useEffect(() => {
    loadStats();
    api.get(E.CATEGORIES.LIST, { params: { limit: 100 } }).then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected && list.data.length > 0) setSelected(list.data[0]);
  }, [list.data, selected]);

  const openForm = (row = null) => {
    setForm(row ? { code: row.code, name: row.name, category_id: row.category_id || "" } : { code: "", name: "", category_id: "" });
    setModal({ row });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request(
        (a) => (modal.row ? a.put(E.SHELVES.DETAIL(modal.row.id), form) : a.post(E.SHELVES.LIST, form)),
        { success: "Data rak berhasil disimpan" }
      );
      setModal(null);
      list.reload();
      loadStats();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!(await confirmToast(`Hapus rak "${row.code} - ${row.name}"?`))) return;
    await request((a) => a.delete(E.SHELVES.DETAIL(row.id)), { success: "Rak dihapus" });
    list.reload();
    loadStats();
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 5) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <Library size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Rak Buku</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola lokasi penyimpanan buku di perpustakaan</p>
          </div>
        </div>
        <button className="btn btn-primary self-start sm:self-auto" onClick={() => openForm()}>
          <Plus size={17} /> Tambah Rak
        </button>
      </div>

      {/* 5 Summary Stat Cards (Page 5) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Library} value={stats?.total_shelves ?? 0} label="Total Rak" tone="emerald" loading={!stats} />
        <StatCard icon={Layers} value={stats?.total_copies ?? 0} label="Total Eksemplar" tone="teal" loading={!stats} />
        <StatCard icon={BookOpen} value={stats?.available_copies ?? 0} label="Buku Tersedia" tone="emerald" loading={!stats} />
        <StatCard icon={BookMarked} value={stats?.borrowed_copies ?? 0} label="Buku Dipinjam" tone="amber" loading={!stats} />
        <StatCard icon={Box} value={stats?.avg_per_shelf ?? 0} label="Rata-rata per Rak" subtitle="Eksemplar / rak" tone="slate" loading={!stats} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Table */}
        <div className="lg:col-span-8">
          <DataTable
            list={list}
            placeholder="Cari kode atau nama rak..."
            onRowClick={(r) => setSelected(r)}
            selectedRowId={selected?.id}
            filters={
              <>
                <select
                  className="input w-40"
                  value={filters.category_id}
                  onChange={(e) => { setFilters((f) => ({ ...f, category_id: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  className="input w-36"
                  value={filters.sortBy}
                  onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
                >
                  <option value="code">Urut: Kode Rak</option>
                  <option value="name">Urut: Nama Rak</option>
                </select>
                <button className="btn btn-ghost btn-sm py-2.5" onClick={() => { setFilters({ category_id: "", sortBy: "code" }); list.setParams((p) => ({ ...p, search: "", page: 1 })); }}>
                  <RotateCcw size={15} /> Reset
                </button>
              </>
            }
            columns={[
              { label: "Kode Rak", render: (r) => <span className="font-mono font-extrabold text-emerald-900 dark:text-emerald-300">{r.code}</span> },
              { label: "Nama Rak", render: (r) => <span className="font-semibold text-slate-800 dark:text-white">{r.name}</span> },
              {
                label: "Kategori Buku",
                render: (r) =>
                  r.category_name ? (
                    <span className="badge bg-emerald-100 text-emerald-800">{r.category_name}</span>
                  ) : (
                    <span className="text-xs text-slate-400">Umum</span>
                  ),
              },
              { label: "Jumlah Judul", key: "total_titles" },
              { label: "Jumlah Eksemplar", render: (r) => <b className="text-emerald-800 dark:text-emerald-300">{r.total_copies}</b> },
            ]}
            actions={(r) => (
              <>
                <button className="btn btn-primary btn-sm !px-2" onClick={() => openForm(r)}><Pencil size={14} /></button>
                <button className="btn btn-danger btn-sm !px-2" onClick={() => remove(r)}><Trash2 size={14} /></button>
              </>
            )}
          />
        </div>

        {/* Right: Detail Rak + Distribusi Buku per Rak */}
        <div className="space-y-5 lg:col-span-4">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Info size={18} className="text-emerald-700" /> Detail Rak
              </div>
            </div>
            <div className="p-5">
              {selected ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-amber-700 to-amber-900 p-2 text-white shadow-md">
                    <span className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold">{selected.code}</span>
                    <Library size={30} className="mt-2 text-amber-200" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div><span className="text-slate-400">Kode Rak:</span> <b className="text-slate-800 dark:text-white">{selected.code}</b></div>
                    <div><span className="text-slate-400">Nama Rak:</span> <b className="text-slate-800 dark:text-white">{selected.name}</b></div>
                    <div><span className="text-slate-400">Kategori:</span> <span className="badge bg-emerald-100 text-emerald-800">{selected.category_name || "Umum"}</span></div>
                    <div><span className="text-slate-400">Jumlah Judul:</span> <b>{selected.total_titles} judul</b></div>
                    <div><span className="text-slate-400">Jumlah Eksemplar:</span> <b className="text-emerald-700">{selected.total_copies} eksemplar</b></div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Klik baris rak untuk melihat detailnya.</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <BarChart3 size={18} className="text-emerald-700" /> Distribusi Buku per Rak
              </div>
            </div>
            <div className="p-5">
              <HorizontalBarList
                items={(stats?.distribution || []).map((d) => ({
                  label: `${d.code} – ${d.name}`,
                  value: Number(d.total_copies || 0),
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={!!modal} title={modal?.row ? "Edit Rak Buku" : "Tambah Rak Buku"} onClose={() => setModal(null)}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Kode Rak *</label>
            <input className="input" required placeholder="Contoh: A1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="label">Nama Rak *</label>
            <input className="input" required placeholder="Contoh: Rak Sejarah Islam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Kategori Utama (opsional)</label>
            <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Umum / Semua Kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
