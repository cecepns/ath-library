import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal";
import DataTable from "./DataTable";
import { useList } from "@/hooks/useList";
import { api } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast } from "@/utils/confirm";

// Halaman CRUD reusable: list + modal create/edit + confirm delete
export default function CrudPage({ title, endpoint, detail, fields, columns, extra, rowActions, canCreate = true, canEdit = true, canDelete = true, wide }) {
  const list = useList(endpoint, extra);
  const [modal, setModal] = useState(null); // {row?}
  const [form, setForm] = useState({});
  const [options, setOptions] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fields.filter((f) => f.optionsFrom).forEach(async (f) => {
      const { data } = await api.get(f.optionsFrom, { params: { limit: 100 } });
      setOptions((o) => ({ ...o, [f.name]: data.data.map((d) => ({ value: d.id, label: d[f.optionLabel || "name"] })) }));
    });
  }, [fields]);

  const openForm = (row) => { setForm(row ? { ...row } : Object.fromEntries(fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default]))); setErrors({}); setModal({ row }); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    fields.forEach((f) => { if (f.required && !form[f.name]) err[f.name] = `${f.label} wajib diisi`; });
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fields.forEach((f) => { if (form[f.name] != null && form[f.name] !== "") fd.append(f.name, form[f.name]); });
    setSaving(true);
    try {
      await request((a) => (modal.row ? a.put(detail(modal.row.id), fd) : a.post(endpoint, fd)), { success: "Data tersimpan" });
      setModal(null); list.reload();
    } catch { /* toast ditangani request() */ } finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!(await confirmToast("Yakin hapus data ini?"))) return;
    try { await request((a) => a.delete(detail(row.id)), { success: "Data dihapus" }); list.reload(); } catch { /* noop */ }
  };

  const renderField = (f) => {
    const common = { className: "input", value: form[f.name] ?? "", onChange: (e) => setForm({ ...form, [f.name]: e.target.value }) };
    const opts = f.options?.map((o) => (typeof o === "string" ? { value: o, label: o } : o)) || options[f.name] || [];
    return (
      <div key={f.name}>
        <label className="mb-1 block text-sm font-medium">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
        {f.type === "select" ? (
          <select {...common}><option value="">Pilih...</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        ) : f.type === "file" ? (
          <input type="file" accept="image/png,image/jpeg" className="input" onChange={(e) => setForm({ ...form, [f.name]: e.target.files[0] })} />
        ) : f.type === "textarea" ? (
          <textarea {...common} maxLength={250} rows={2} />
        ) : (
          <input {...common} type={f.type || "text"} min={f.type === "number" ? 1 : undefined} />
        )}
        {errors[f.name] && <p className="mt-1 text-xs text-red-600">{errors[f.name]}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-900">{title}</h1>
        {canCreate && <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} />Tambah</button>}
      </div>
      <DataTable columns={columns} list={list} actions={(row) => (
        <>
          {rowActions?.(row, list.reload)}
          {canEdit && <button className="btn btn-primary !px-2" onClick={() => openForm(row)}><Pencil size={14} /></button>}
          {canDelete && <button className="btn !px-2 bg-red-100 text-red-600" onClick={() => remove(row)}><Trash2 size={14} /></button>}
        </>
      )} />
      <Modal open={!!modal} wide={wide} title={modal?.row ? `Edit ${title}` : `Tambah ${title}`} onClose={() => setModal(null)}>
        <form onSubmit={submit} className={`grid gap-3 ${wide ? "sm:grid-cols-2" : ""}`}>
          {fields.map(renderField)}
          <div className={`flex justify-end gap-2 pt-2 ${wide ? "sm:col-span-2" : ""}`}>
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
