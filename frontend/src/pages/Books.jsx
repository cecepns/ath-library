import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Layers, CheckCircle2, BookMarked, Wrench, PackageX,
  Plus, Upload, QrCode, Download, RotateCcw, Eye, Pencil, Trash2, Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { useList } from "@/hooks/useList";
import { api, fileUrl } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast } from "@/utils/confirm";
import { exportCSV, parseCSV } from "@/utils/csv";
import { makeQrDataUrl, downloadQrLabelPng, downloadBatchQrSheetPng } from "@/utils/qr";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const CAT_PILLS = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
];

export const BOOK_COLUMNS = [
  {
    label: "Sampul",
    render: (r) =>
      r.cover ? (
        <img src={fileUrl(r.cover)} alt={r.title} className="h-12 w-9 rounded-lg object-cover shadow-sm ring-1 ring-slate-200" />
      ) : (
        <div className="flex h-12 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-900 text-[10px] font-bold text-white shadow-sm">
          ATH
        </div>
      ),
  },
  { label: "Kode/Inventaris", render: (r) => <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-300">{r.inventory_code}</span> },
  { label: "Judul Buku", render: (r) => <div className="font-bold text-slate-800 dark:text-white">{r.title}</div> },
  { label: "Penulis", key: "author" },
  {
    label: "Kategori",
    render: (r) => <span className={`badge ${CAT_PILLS[(r.category_id || 0) % CAT_PILLS.length]}`}>{r.category_name}</span>,
  },
  { label: "Rak", render: (r) => <span className="font-semibold text-slate-700 dark:text-slate-200">{r.shelf_code}</span> },
  { label: "Eksemplar", key: "copies" },
  {
    label: "Tersedia",
    render: (r) => (
      <span className={`inline-flex min-w-[28px] justify-center rounded-lg px-2 py-0.5 text-xs font-bold ${r.available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
        {r.available}
      </span>
    ),
  },
  {
    label: "Status",
    render: (r) => {
      if (r.condition === "rusak") return <span className="badge bg-rose-100 text-rose-700">Rusak</span>;
      if (r.condition === "hilang") return <span className="badge bg-slate-200 text-slate-700">Hilang</span>;
      if (r.available > 0) return <span className="badge bg-emerald-100 text-emerald-700">Tersedia</span>;
      return <span className="badge bg-amber-100 text-amber-800">Dipinjam</span>;
    },
  },
];

export default function Books() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [filters, setFilters] = useState({ category_id: "", shelf_id: "", status: "" });
  const list = useList(E.BOOKS.LIST, filters);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [detail, setDetail] = useState(null);
  const [qr, setQr] = useState(null);
  const [batchQr, setBatchQr] = useState(null);

  const loadMeta = () => {
    api.get(E.BOOKS.STATS).then(({ data }) => setStats(data.data)).catch(() => {});
  };

  useEffect(() => {
    loadMeta();
    api.get(E.CATEGORIES.LIST, { params: { limit: 100 } }).then(({ data }) => setCategories(data.data || [])).catch(() => {});
    api.get(E.SHELVES.LIST, { params: { limit: 100 } }).then(({ data }) => setShelves(data.data || [])).catch(() => {});
  }, []);

  const resetFilters = () => {
    setFilters({ category_id: "", shelf_id: "", status: "" });
    list.setParams((p) => ({ ...p, search: "", page: 1 }));
  };

  const openDetail = async (row) => {
    setDetail(row);
    const dataUrl = await makeQrDataUrl(row.inventory_code, 300);
    setQr({ code: row.inventory_code, title: row.title, author: row.author, dataUrl });
  };

  const handleDelete = async (row) => {
    if (!(await confirmToast(`Hapus buku "${row.title}" ke Riwayat Terhapus?`))) return;
    await request((a) => a.delete(E.BOOKS.DETAIL(row.id)), { success: "Buku dipindahkan ke Riwayat Terhapus" });
    list.reload();
    loadMeta();
  };

  const printSingleQr = (q) => {
    const w = window.open("", "_blank", "width=420,height=520");
    w.document.write(`
      <div style="font-family:sans-serif;text-align:center;padding:24px;border:2px dashed #065f46;border-radius:12px;max-width:280px;margin:20px auto;">
        <div style="font-weight:800;color:#065f46;margin-bottom:8px;">ATH LIBRARY</div>
        <img src="${q.dataUrl}" style="width:190px;height:190px;" />
        <div style="font-size:18px;font-weight:800;margin-top:8px;">${q.code}</div>
        <div style="font-size:13px;color:#475569;margin-top:4px;">${q.title}</div>
      </div>
    `);
    w.document.close();
    w.print();
  };

  const openBatchQr = async () => {
    if (!list.data.length) return toast.error("Tidak ada buku untuk dicetak QR");
    const items = await Promise.all(
      list.data.map(async (b) => ({
        id: b.id,
        code: b.inventory_code,
        title: b.title,
        author: b.author,
        dataUrl: await makeQrDataUrl(b.inventory_code, 220),
      }))
    );
    setBatchQr(items);
  };

  const printBatchQr = () => {
    if (!batchQr?.length) return;
    const w = window.open("", "_blank", "width=900,height=700");
    const cards = batchQr
      .map(
        (q) => `
      <div style="border:1.5px dashed #065f46;border-radius:10px;padding:12px;text-align:center;page-break-inside:avoid;">
        <div style="font-size:11px;font-weight:800;color:#065f46;">ATH LIBRARY</div>
        <img src="${q.dataUrl}" style="width:120px;height:120px;margin:4px auto;" />
        <div style="font-size:13px;font-weight:800;">${q.code}</div>
        <div style="font-size:11px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${q.title}</div>
      </div>`
      )
      .join("");
    w.document.write(`<div style="font-family:sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;">${cards}</div>`);
    w.document.close();
    w.print();
  };

  const handleExport = () => {
    const headers = ["Kode", "Judul", "Penulis", "Penerbit", "Tahun", "ISBN", "Kategori", "Rak", "Bahasa", "Eksemplar", "Tersedia", "Kondisi"];
    const rows = list.data.map((b) => [b.inventory_code, b.title, b.author, b.publisher, b.year, b.isbn, b.category_name, b.shelf_code, b.language, b.copies, b.available, b.condition]);
    exportCSV("data-buku-ath-library.csv", headers, rows);
    toast.success("Data buku diekspor ke CSV");
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) return toast.error("Format CSV kosong atau tidak valid (butuh header: title,author,copies)");
    await request((a) => a.post(E.BOOKS.IMPORT, { rows }), { success: "Impor buku selesai" });
    e.target.value = "";
    list.reload();
    loadMeta();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Data Buku</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola seluruh koleksi buku perpustakaan</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/buku/tambah" className="btn btn-primary">
            <Plus size={17} /> Tambah Buku
          </Link>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} title="Format CSV: title,author,publisher,year,isbn,copies">
            <Upload size={16} /> Impor CSV
          </button>
          <button className="btn btn-ghost" onClick={openBatchQr}>
            <QrCode size={16} /> Cetak Label QR
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={16} /> Ekspor
          </button>
        </div>
      </div>

      {/* 6 Summary Stat Cards (Page 2) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={BookOpen} value={stats?.total_titles ?? 0} label="Total Judul Buku" tone="emerald" loading={!stats} />
        <StatCard icon={Layers} value={stats?.total_copies ?? 0} label="Total Eksemplar" tone="teal" loading={!stats} />
        <StatCard icon={CheckCircle2} value={stats?.available_copies ?? 0} label="Tersedia" tone="emerald" loading={!stats} />
        <StatCard icon={BookMarked} value={stats?.borrowed_copies ?? 0} label="Sedang Dipinjam" tone="amber" loading={!stats} />
        <StatCard icon={Wrench} value={stats?.damaged_books ?? 0} label="Rusak" tone="rose" loading={!stats} />
        <StatCard icon={PackageX} value={stats?.lost_books ?? 0} label="Hilang" tone="slate" loading={!stats} />
      </div>

      {/* Data Table with Filters */}
      <DataTable
        list={list}
        columns={BOOK_COLUMNS}
        placeholder="Cari judul, penulis, penerbit, kode, atau ISBN..."
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
              value={filters.shelf_id}
              onChange={(e) => { setFilters((f) => ({ ...f, shelf_id: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}
            >
              <option value="">Semua Rak</option>
              {shelves.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
            <select
              className="input w-36"
              value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}
            >
              <option value="">Semua Status</option>
              <option value="tersedia">Tersedia</option>
              <option value="dipinjam">Dipinjam</option>
              <option value="rusak">Rusak</option>
              <option value="hilang">Hilang</option>
            </select>
            <button className="btn btn-ghost btn-sm py-2.5" onClick={resetFilters}>
              <RotateCcw size={15} /> Reset
            </button>
          </>
        }
        actions={(r) => (
          <>
            <button className="btn btn-ghost btn-sm !px-2" title="Detail & QR" onClick={() => openDetail(r)}>
              <Eye size={15} />
            </button>
            <button className="btn btn-primary btn-sm !px-2" title="Edit" onClick={() => navigate(`/buku/edit/${r.id}`)}>
              <Pencil size={15} />
            </button>
            <button className="btn btn-danger btn-sm !px-2" title="Hapus" onClick={() => handleDelete(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      {/* Detail + QR Modal */}
      <Modal open={!!detail} wide title="Detail Buku & Kode QR" onClose={() => setDetail(null)}>
        {detail && (
          <div className="grid gap-5 sm:grid-cols-12">
            <div className="space-y-3 sm:col-span-7">
              <div className="flex gap-4">
                {detail.cover ? (
                  <img src={fileUrl(detail.cover)} alt={detail.title} className="h-32 w-24 rounded-xl object-cover shadow" />
                ) : (
                  <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-lg font-extrabold text-white">ATH</div>
                )}
                <div>
                  <span className="badge bg-emerald-100 text-emerald-800">{detail.inventory_code}</span>
                  <h4 className="mt-1.5 text-lg font-extrabold text-slate-900 dark:text-white">{detail.title}</h4>
                  <p className="text-sm text-slate-500">{detail.author}</p>
                  <p className="mt-1 text-xs text-slate-400">{detail.publisher || "-"} · {detail.year || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-slate-900">
                <div><span className="text-slate-400">Kategori:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.category_name}</b></div>
                <div><span className="text-slate-400">Sub Kategori:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.subcategory || "-"}</b></div>
                <div><span className="text-slate-400">Lokasi Rak:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.shelf_code} - {detail.shelf_name}</b></div>
                <div><span className="text-slate-400">Bahasa:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.language}</b></div>
                <div><span className="text-slate-400">ISBN:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.isbn || "-"}</b></div>
                <div><span className="text-slate-400">Sumber:</span> <b className="block text-slate-700 dark:text-slate-200">{detail.acquisition_source || "Pembelian"}</b></div>
                <div><span className="text-slate-400">Eksemplar / Tersedia:</span> <b className="block text-emerald-700">{detail.copies} / {detail.available}</b></div>
                <div><span className="text-slate-400">Kondisi:</span> <b className="block capitalize text-slate-700 dark:text-slate-200">{detail.condition?.replace("_", " ")}</b></div>
              </div>
              {detail.note && <p className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">{detail.note}</p>}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center sm:col-span-5">
              {qr ? (
                <>
                  <img src={qr.dataUrl} alt="QR" className="h-44 w-44 rounded-xl bg-white p-2 shadow" />
                  <div className="mt-2 font-mono text-base font-extrabold text-emerald-900">{qr.code}</div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => downloadQrLabelPng({ code: qr.code, title: qr.title })}>
                      <Download size={15} /> Simpan Gambar (PNG)
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => printSingleQr(qr)}>
                      <Printer size={15} /> Cetak PDF
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-xs text-slate-400">Memuat QR...</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Batch QR Modal */}
      <Modal open={!!batchQr} xl title={`Cetak Label QR (${batchQr?.length || 0} Buku)`} onClose={() => setBatchQr(null)}>
        {batchQr && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {batchQr.map((q) => (
                <div key={q.id} className="rounded-xl border border-dashed border-emerald-400 bg-white p-3 text-center">
                  <img src={q.dataUrl} alt={q.code} className="mx-auto h-28 w-28" />
                  <div className="mt-1 font-mono text-xs font-extrabold text-emerald-900">{q.code}</div>
                  <div className="truncate text-[11px] text-slate-500">{q.title}</div>
                  <button
                    type="button"
                    onClick={() => downloadQrLabelPng({ code: q.code, title: q.title })}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Download size={12} /> Simpan PNG
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setBatchQr(null)}>Tutup</button>
              <button className="btn btn-secondary" onClick={() => downloadBatchQrSheetPng(batchQr)}><Download size={16} /> Simpan Semua (PNG)</button>
              <button className="btn btn-primary" onClick={printBatchQr}><Printer size={16} /> Cetak Semua Label</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
