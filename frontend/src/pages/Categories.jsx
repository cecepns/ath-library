import { useEffect, useState } from "react";
import {
  Layers, Plus, Pencil, Trash2, Folder, FolderOpen, FileText, Info,
  Landmark, Languages, FlaskConical, GraduationCap, Feather, Globe, Heart, Briefcase, BookOpen, ChevronDown, ChevronRight,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { useList } from "@/hooks/useList";
import { api } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const ICON_MAP = {
  landmark: Landmark,
  languages: Languages,
  flask: FlaskConical,
  graduation: GraduationCap,
  feather: Feather,
  globe: Globe,
  heart: Heart,
  briefcase: Briefcase,
  book: BookOpen,
};

export default function Categories() {
  const list = useList(E.CATEGORIES.LIST);
  const [tree, setTree] = useState([]);
  const [openIds, setOpenIds] = useState({});
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "book" });
  const [saving, setSaving] = useState(false);

  const loadTree = () => {
    api.get(E.CATEGORIES.TREE).then(({ data }) => {
      const rows = data.data || [];
      setTree(rows);
      if (rows[0]) setOpenIds((o) => (Object.keys(o).length ? o : { [rows[0].id]: true }));
    }).catch(() => {});
  };

  useEffect(() => { loadTree(); }, []);

  const openForm = (row = null) => {
    setForm(row ? { name: row.name, description: row.description || "", icon: row.icon || "book" } : { name: "", description: "", icon: "book" });
    setModal({ row });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request(
        (a) => (modal.row ? a.put(E.CATEGORIES.DETAIL(modal.row.id), form) : a.post(E.CATEGORIES.LIST, form)),
        { success: "Kategori berhasil disimpan" }
      );
      setModal(null);
      list.reload();
      loadTree();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!(await confirmToast(`Hapus kategori "${row.name}"?`))) return;
    await request((a) => a.delete(E.CATEGORIES.DETAIL(row.id)), { success: "Kategori dihapus" });
    list.reload();
    loadTree();
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 4) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Kategori Buku</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola kategori dan subkategori koleksi buku</p>
          </div>
        </div>
        <button className="btn btn-primary self-start sm:self-auto" onClick={() => openForm()}>
          <Plus size={17} /> Tambah Kategori
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Table */}
        <div className="lg:col-span-8">
          <DataTable
            list={list}
            placeholder="Cari nama kategori..."
            columns={[
              {
                label: "Nama Kategori",
                render: (r) => {
                  const Icon = ICON_MAP[r.icon] || BookOpen;
                  return (
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Icon size={18} />
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white">{r.name}</div>
                        {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
                      </div>
                    </div>
                  );
                },
              },
              { label: "Jumlah Judul", render: (r) => <span className="font-bold text-slate-700 dark:text-slate-200">{r.total_titles}</span> },
              { label: "Jumlah Eksemplar", render: (r) => <span className="font-bold text-emerald-700 dark:text-emerald-300">{r.total_copies}</span> },
            ]}
            actions={(r) => (
              <>
                <button className="btn btn-primary btn-sm !px-2" onClick={() => openForm(r)}><Pencil size={14} /></button>
                <button className="btn btn-danger btn-sm !px-2" onClick={() => remove(r)}><Trash2 size={14} /></button>
              </>
            )}
          />
        </div>

        {/* Right: Struktur Kategori Tree + Keterangan */}
        <div className="space-y-4 lg:col-span-4">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <FolderOpen size={18} className="text-emerald-700" /> Struktur Kategori
              </div>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto p-4">
              {tree.map((c) => {
                const open = !!openIds[c.id];
                return (
                  <div key={c.id} className="rounded-xl border border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setOpenIds((o) => ({ ...o, [c.id]: !o[c.id] }))}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-emerald-50/60 dark:text-slate-200 dark:hover:bg-slate-700/50"
                    >
                      {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                      <Folder size={17} className="shrink-0 text-amber-500" />
                      <span className="truncate flex-1">{c.name}</span>
                      <span className="text-xs font-semibold text-slate-400">({c.total_titles} judul)</span>
                    </button>
                    {open && (
                      <div className="space-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                        {c.subcategories.length === 0 ? (
                          <div className="text-xs italic text-slate-400">Belum ada buku di kategori ini</div>
                        ) : (
                          c.subcategories.map((s) => (
                            <div key={s.sub_name} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span className="flex items-center gap-2">
                                <FileText size={13} className="text-emerald-600" /> {s.sub_name}
                              </span>
                              <span className="font-bold text-emerald-800 dark:text-emerald-300">({s.total})</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
                <Info size={16} />
              </span>
              <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <div className="mb-1 font-bold text-emerald-950 dark:text-emerald-200">Keterangan</div>
                Kategori digunakan untuk mengelompokkan koleksi buku agar pencarian, penyusunan rak, dan pelaporan koleksi lebih mudah.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={!!modal} title={modal?.row ? "Edit Kategori" : "Tambah Kategori"} onClose={() => setModal(null)}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nama Kategori *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Ikon Kategori</label>
            <select className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
              <option value="landmark">Keislaman / Masjid</option>
              <option value="languages">Bahasa</option>
              <option value="flask">Sains & Teknologi</option>
              <option value="graduation">Pendidikan</option>
              <option value="feather">Sastra & Novel</option>
              <option value="globe">Sejarah & Biografi</option>
              <option value="heart">Kesehatan</option>
              <option value="briefcase">Umum & Referensi</option>
              <option value="book">Buku Umum</option>
            </select>
          </div>
          <div>
            <label className="label">Keterangan</label>
            <textarea rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
