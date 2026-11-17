import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookPlus, ArrowLeft, Upload, Trash2, QrCode, Printer, Save, Plus, X, Minus,
  BookOpen, Layers, FileText, Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, fileUrl } from "@/utils/api";
import { request } from "@/utils/request";
import { makeQrDataUrl } from "@/utils/qr";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const EMPTY = {
  inventory_code: "",
  title: "",
  author: "",
  publisher: "",
  year: new Date().getFullYear(),
  isbn: "",
  category_id: "",
  subcategory: "",
  shelf_id: "",
  language: "Indonesia",
  acquisition_source: "Pembelian",
  copies: 1,
  condition: "baik",
  note: "",
};

export default function BookForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadNextCode = async () => {
    try {
      const { data } = await api.get(E.BOOKS.NEXT_CODE);
      setForm((f) => ({ ...f, inventory_code: data.data.code }));
    } catch { /* noop */ }
  };

  // Generate QR preview langsung di frontend setiap kali kode inventaris berubah
  useEffect(() => {
    let active = true;
    const code = (form.inventory_code || "").trim();
    if (!code) { setQrPreview(null); return; }
    makeQrDataUrl(code, 240).then((dataUrl) => {
      if (active) setQrPreview({ code, dataUrl });
    });
    return () => { active = false; };
  }, [form.inventory_code]);

  useEffect(() => {
    api.get(E.CATEGORIES.LIST, { params: { limit: 100 } }).then(({ data }) => setCategories(data.data || [])).catch(() => {});
    api.get(E.SHELVES.LIST, { params: { limit: 100 } }).then(({ data }) => setShelves(data.data || [])).catch(() => {});

    if (isEdit) {
      api.get(E.BOOKS.DETAIL(id)).then(({ data }) => {
        const b = data.data;
        setForm({
          inventory_code: b.inventory_code || "",
          title: b.title || "",
          author: b.author || "",
          publisher: b.publisher || "",
          year: b.year || "",
          isbn: b.isbn || "",
          category_id: b.category_id || "",
          subcategory: b.subcategory || "",
          shelf_id: b.shelf_id || "",
          language: b.language || "Indonesia",
          acquisition_source: b.acquisition_source || "Pembelian",
          copies: b.copies || 1,
          condition: b.condition || "baik",
          note: b.note || "",
        });
        if (b.cover) setCoverPreview(fileUrl(b.cover));
      }).catch(() => toast.error("Gagal memuat data buku"));
    } else {
      loadNextCode();
    }
  }, [id, isEdit]);

  const onSelectCover = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran sampul maksimal 2MB");
    setCoverFile(file);
    setRemoveCover(false);
    setCoverPreview(URL.createObjectURL(file));
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (andAddMore = false) => {
    if (!form.title.trim() || !form.author.trim() || !form.category_id || !form.shelf_id) {
      return toast.error("Judul, Penulis, Kategori, dan Lokasi Rak wajib diisi");
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") fd.append(k, v);
    });
    if (coverFile) fd.append("cover", coverFile);
    if (removeCover) fd.append("remove_cover", "1");

    setSaving(true);
    try {
      await request(
        (a) => (isEdit ? a.put(E.BOOKS.DETAIL(id), fd) : a.post(E.BOOKS.LIST, fd)),
        { success: isEdit ? "Data buku berhasil diperbarui" : "Buku baru berhasil ditambahkan" }
      );
      if (andAddMore && !isEdit) {
        setForm(EMPTY);
        clearCover();
        await loadNextCode();
      } else {
        navigate("/buku");
      }
    } catch { /* toast handled */ } finally {
      setSaving(false);
    }
  };

  const printQr = () => {
    if (!qrPreview?.dataUrl) return;
    const w = window.open("", "_blank", "width=400,height=480");
    w.document.write(`<div style="text-align:center;font-family:sans-serif;padding:24px;"><img src="${qrPreview.dataUrl}" style="width:180px;"/><h3>${form.inventory_code || qrPreview.code}</h3><p>${form.title || "Buku Perpustakaan"}</p></div>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-5">
      {/* Header (Page 3) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <BookPlus size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">
              {isEdit ? "Edit Data Buku" : "Tambah Buku"}
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isEdit ? "Perbarui informasi koleksi buku perpustakaan" : "Input data koleksi buku baru ke dalam perpustakaan"}
            </p>
          </div>
        </div>
        <Link to="/buku" className="btn btn-ghost self-start sm:self-auto">
          <ArrowLeft size={16} /> Kembali ke Daftar Buku
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* LEFT MAIN FORM (8 cols) */}
        <div className="space-y-5 lg:col-span-8">
          {/* Informasi Buku */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <BookOpen size={18} className="text-emerald-700" /> Informasi Buku
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="label">Judul Buku <span className="text-rose-500">*</span></label>
                <input className="input" placeholder="Contoh: Sejarah Peradaban Islam" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Kategori <span className="text-rose-500">*</span></label>
                <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Pilih kategori...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Penulis <span className="text-rose-500">*</span></label>
                <input className="input" placeholder="Contoh: Dr. Yusuf Qardhawi" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div>
                <label className="label">Sub Kategori (opsional)</label>
                <input className="input" placeholder="Contoh: Peradaban Islam / Fiqih" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
              </div>
              <div>
                <label className="label">Penerbit</label>
                <input className="input" placeholder="Contoh: Pustaka Islam" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
              </div>
              <div>
                <label className="label">Lokasi Rak <span className="text-rose-500">*</span></label>
                <select className="input" value={form.shelf_id} onChange={(e) => setForm({ ...form, shelf_id: e.target.value })}>
                  <option value="">Pilih lokasi rak...</option>
                  {shelves.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tahun Terbit</label>
                <input type="number" className="input" placeholder="2024" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div>
                <label className="label">Bahasa</label>
                <select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  {["Indonesia", "Inggris", "Arab", "China", "Jepang", "Multibahasa"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ISBN (opsional)</label>
                <input className="input" placeholder="978-602-1234-56-7" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
              </div>
              <div>
                <label className="label">Sumber Perolehan <span className="text-rose-500">*</span></label>
                <select className="input" value={form.acquisition_source} onChange={(e) => setForm({ ...form, acquisition_source: e.target.value })}>
                  {["Pembelian", "Donasi", "Hibah", "Program/Kerja Sama"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Data Eksemplar */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Layers size={18} className="text-emerald-700" /> Data Eksemplar
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="label">Jumlah Eksemplar <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost !px-3"
                    onClick={() => setForm((f) => ({ ...f, copies: Math.max(1, Number(f.copies || 1) - 1) }))}
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    className="input text-center font-bold"
                    value={form.copies}
                    onChange={(e) => setForm({ ...form, copies: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost !px-3"
                    onClick={() => setForm((f) => ({ ...f, copies: Number(f.copies || 1) + 1 }))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Kondisi Buku</label>
                <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  <option value="baik">Baik</option>
                  <option value="kurang_baik">Kurang Baik</option>
                  <option value="rusak">Rusak</option>
                  <option value="hilang">Hilang</option>
                </select>
              </div>
            </div>
          </div>

          {/* Keterangan */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <FileText size={18} className="text-emerald-700" /> Keterangan
              </div>
            </div>
            <div className="p-5">
              <textarea
                rows={3}
                maxLength={250}
                className="input"
                placeholder="Catatan tambahan (opsional), misalnya edisi, donatur, atau keterangan lainnya..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              <div className="mt-1 text-right text-xs text-slate-400">{(form.note || "").length} / 250</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving} onClick={() => submit(false)} className="btn btn-primary px-6">
              <Save size={17} /> {saving ? "Menyimpan..." : "Simpan"}
            </button>
            {!isEdit && (
              <button type="button" disabled={saving} onClick={() => submit(true)} className="btn btn-secondary px-5">
                <Plus size={17} /> Simpan & Tambah Lagi
              </button>
            )}
            <Link to="/buku" className="btn btn-ghost">
              <X size={17} /> Batal
            </Link>
          </div>
        </div>

        {/* RIGHT SIDEBAR (4 cols): Sampul Buku + Kode Inventaris & QR */}
        <div className="space-y-5 lg:col-span-4">
          {/* Sampul Buku */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <ImageIcon size={18} className="text-emerald-700" /> Sampul Buku
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-800 to-emerald-950 text-center text-white shadow-inner">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Sampul" className="h-full w-full object-cover" />
                  ) : (
                    <div className="p-3">
                      <BookOpen size={30} className="mx-auto mb-2 text-amber-300" />
                      <div className="line-clamp-3 text-xs font-bold">{form.title || "Pratinjau Sampul"}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onSelectCover} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-5 text-center transition hover:border-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                  >
                    <Upload size={22} className="text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Unggah Sampul</span>
                    <span className="text-[11px] text-slate-400">JPG, PNG (Maks. 2 MB)</span>
                  </button>
                  {coverPreview && (
                    <button type="button" onClick={clearCover} className="btn btn-danger btn-sm w-full">
                      <Trash2 size={14} /> Hapus Sampul
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Kode Inventaris & QR */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <QrCode size={18} className="text-emerald-700" /> Kode Inventaris & QR
              </div>
            </div>
            <div className="flex items-center gap-4 p-5">
              <div className="flex-1 space-y-2">
                <label className="label">Kode/No. Inventaris</label>
                <input
                  className="input font-mono font-bold text-emerald-900"
                  value={form.inventory_code}
                  onChange={(e) => setForm({ ...form, inventory_code: e.target.value })}
                  placeholder="Otomatis ATH-XXXX"
                />
                <p className="text-[11px] text-slate-400">Kode dibuat otomatis jika dibiarkan default.</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                {qrPreview?.dataUrl && (
                  <img src={qrPreview.dataUrl} alt="QR" className="h-24 w-24 rounded-xl border border-slate-200 bg-white p-1" />
                )}
                <button type="button" onClick={printQr} className="btn btn-secondary btn-sm">
                  <Printer size={14} /> Cetak QR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
