import { useState } from "react";
import { BedDouble, Plus, Pencil, Trash2, Users } from "lucide-react";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { useList } from "@/hooks/useList";
import { request } from "@/utils/request";
import { confirmToast } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const EMPTY = { name: "", description: "", status: "aktif" };

export default function Rooms() {
  const list = useList(E.ROOMS.LIST);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openForm = (row = null) => {
    setForm(row ? { name: row.name, description: row.description || "", status: row.status || "aktif" } : EMPTY);
    setModal({ row });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request(
        (a) => (modal.row ? a.put(E.ROOMS.DETAIL(modal.row.id), form) : a.post(E.ROOMS.LIST, form)),
        { success: modal.row ? "Data kamar diperbarui" : "Kamar baru berhasil ditambahkan" }
      );
      setModal(null);
      list.reload();
    } catch { /* toast handled */ } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!(await confirmToast(`Hapus kamar "${row.name}"?`))) return;
    await request((a) => a.delete(E.ROOMS.DETAIL(row.id)), { success: "Data kamar dihapus" });
    list.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <BedDouble size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Data Kamar</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Kelola daftar kamar/asrama pesantren (otomatis tampil pada pilihan kamar di Data Anggota)
            </p>
          </div>
        </div>
        <button className="btn btn-primary self-start sm:self-auto" onClick={() => openForm()}>
          <Plus size={17} /> Tambah Kamar
        </button>
      </div>

      <DataTable
        list={list}
        placeholder="Cari nama kamar atau keterangan..."
        columns={[
          {
            label: "Nama Kamar",
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <BedDouble size={16} />
                </span>
                <span className="font-bold text-slate-800 dark:text-white">{r.name}</span>
              </div>
            ),
          },
          { label: "Keterangan", render: (r) => <span className="text-slate-600 dark:text-slate-300">{r.description || "-"}</span> },
          {
            label: "Jumlah Anggota",
            render: (r) => (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                <Users size={14} /> {r.total_members ?? 0} orang
              </span>
            ),
          },
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
            <button className="btn btn-primary btn-sm !px-2" title="Edit" onClick={() => openForm(r)}>
              <Pencil size={14} />
            </button>
            <button className="btn btn-danger btn-sm !px-2" title="Hapus" onClick={() => remove(r)}>
              <Trash2 size={14} />
            </button>
          </>
        )}
      />

      <Modal open={!!modal} title={modal?.row ? "Edit Kamar" : "Tambah Kamar Baru"} onClose={() => setModal(null)}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nama Kamar *</label>
            <input
              className="input"
              required
              placeholder="Contoh: Poskestren, Abu Bakar, Asrama Baru..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Keterangan (opsional)</label>
            <input
              className="input"
              placeholder="Contoh: Asrama Santri Putra Lantai 2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="aktif">Aktif</option>
              <option value="tidak_aktif">Tidak Aktif</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Kamar"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
