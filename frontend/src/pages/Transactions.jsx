import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, BookOpen, Undo2, CalendarPlus, History, Search, QrCode, Camera,
  Trash2, Printer, X, CheckCircle2, Info, Eye, Wallet, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import QrScannerModal from "@/components/QrScannerModal";
import { useList } from "@/hooks/useList";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { api, fileUrl } from "@/utils/api";
import { request } from "@/utils/request";
import { confirmToast, formatDateID, rupiah, todayISO, addDaysISO } from "@/utils/confirm";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const TABS = [
  { key: "peminjaman", path: "/transaksi/peminjaman", label: "Peminjaman", icon: BookOpen },
  { key: "pengembalian", path: "/transaksi/pengembalian", label: "Pengembalian", icon: Undo2 },
  { key: "perpanjangan", path: "/transaksi/perpanjangan", label: "Perpanjangan", icon: CalendarPlus },
  { key: "riwayat", path: "/transaksi/riwayat", label: "Riwayat Transaksi", icon: History },
];

function MemberPicker({ member, onSelect, onClear }) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [found, setFound] = useState([]);
  const [camOpen, setCamOpen] = useState(false);

  useEffect(() => {
    if (!dq || member) return setFound([]);
    api.get(E.MEMBERS.LIST, { params: { search: dq, limit: 6, status: "aktif" } })
      .then(({ data }) => setFound(data.data || []))
      .catch(() => {});
  }, [dq, member]);

  const handleScanMember = async (code) => {
    try {
      const { data } = await api.get(E.MEMBERS.LIST, { params: { search: code, limit: 5, status: "aktif" } });
      const rows = data.data || [];
      const exact = rows.find((m) => m.member_no?.toLowerCase() === code.toLowerCase()) || rows[0];
      if (!exact) return toast.error(`Anggota "${code}" tidak ditemukan`);
      onSelect(exact);
      toast.success(`Anggota dipilih: ${exact.name}`);
    } catch {
      toast.error("Gagal mencari data anggota");
    }
  };

  if (member) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex items-center gap-3">
          {member.photo ? (
            <img src={fileUrl(member.photo)} alt={member.name} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-sm font-extrabold text-white">
              {(member.name || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{member.name}</span>
              <span className="badge bg-emerald-700 text-white font-mono">{member.member_no}</span>
            </div>
            <div className="text-xs text-slate-500">Jenjang: <b>{member.level || "-"}</b> · Kamar: <b>{member.room || "-"}</b></div>
          </div>
        </div>
        <button type="button" onClick={() => { onClear(); setQ(""); }} className="btn btn-ghost btn-sm">Ganti</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Cari nama atau nomor anggota (mis. ATH-1001)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setCamOpen(true)}
          className="btn btn-secondary !px-3"
          title="Scan Kartu Anggota dengan Kamera"
        >
          <Camera size={17} />
        </button>
      </div>
      {found.length > 0 && (
        <ul className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {found.map((m) => (
            <li
              key={m.id}
              onClick={() => { onSelect(m); setFound([]); }}
              className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-slate-700"
            >
              <span><b>{m.name}</b> <span className="text-xs text-slate-400">({m.member_no})</span></span>
              <span className="text-xs text-emerald-700">{m.level || "-"} · {m.room || "-"}</span>
            </li>
          ))}
        </ul>
      )}
      <QrScannerModal
        open={camOpen}
        title="Scan Kartu Anggota"
        subtitle="Arahkan kamera ke QR / Barcode nomor anggota (mis. ATH-1001)"
        onScan={handleScanMember}
        onClose={() => setCamOpen(false)}
      />
    </div>
  );
}

// ======================================================
// TAB 1: PEMINJAMAN BUKU (Page 7)
// ======================================================
function LoanTab() {
  const { settings } = useAuth();
  const maxBooks = Number(settings.max_books) || 3;
  const defaultDays = Number(settings.loan_days) || 14;
  const loanFee = Number(settings.loan_fee) || 2000;
  const maxExtend = Number(settings.max_extend) || 1;

  const [member, setMember] = useState(null);
  const [bookQuery, setBookQuery] = useState("");
  const dqBook = useDebounce(bookQuery, 250);
  const [bookResults, setBookResults] = useState([]);
  const [books, setBooks] = useState([]);
  const [loanDate, setLoanDate] = useState(todayISO());
  const [days, setDays] = useState(defaultDays);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState("Tunai");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const recent = useList(E.LOANS.LIST);

  useEffect(() => {
    if (!dqBook.trim()) return setBookResults([]);
    api.get(E.BOOKS.LIST, { params: { search: dqBook, limit: 6 } })
      .then(({ data }) => setBookResults(data.data || []))
      .catch(() => {});
  }, [dqBook]);

  const addBookObj = (b) => {
    setBooks((prev) => {
      if (prev.length >= maxBooks) {
        toast.error(`Maksimal peminjaman ${maxBooks} buku`);
        return prev;
      }
      if (prev.some((x) => x.id === b.id)) {
        toast.error("Buku sudah masuk daftar");
        return prev;
      }
      if (Number(b.available) < 1) {
        toast.error("Stok buku ini sedang habis");
        return prev;
      }
      toast.success(`Buku ditambahkan: ${b.title}`);
      return [...prev, b];
    });
    setBookQuery("");
    setBookResults([]);
  };

  const lookupBookByCode = async (rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code) return;
    try {
      const { data } = await api.get(E.BOOKS.BY_CODE(code));
      addBookObj(data.data);
    } catch {
      if (bookResults.length === 1 && code === bookQuery.trim()) addBookObj(bookResults[0]);
      else toast.error(`Kode buku / ISBN "${code}" tidak ditemukan`);
    }
  };

  const scanOrSubmitCode = async (e) => {
    e.preventDefault();
    await lookupBookByCode(bookQuery);
  };

  const totalFee = books.length * loanFee;
  const dueDate = addDaysISO(loanDate, days);

  const resetForm = () => {
    setMember(null);
    setBooks([]);
    setBookQuery("");
    setNote("");
    setPaid(true);
    setMethod("Tunai");
  };

  const saveLoan = async () => {
    if (!member) return toast.error("Pilih anggota terlebih dahulu");
    if (!books.length) return toast.error("Tambahkan minimal 1 buku");
    setSaving(true);
    try {
      const res = await request(
        (a) => a.post(E.LOANS.LIST, { member_id: member.id, book_ids: books.map((b) => b.id), loan_date: loanDate, due_date: dueDate, paid, payment_method: method, note }),
        { success: "Transaksi peminjaman tersimpan!" }
      );
      setLastSaved({ trx_no: res.trx_no, member, books: [...books], loanDate, dueDate, totalFee, paid, method });
      resetForm();
      recent.reload();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  const printReceipt = (info) => {
    const d = info || lastSaved;
    if (!d) return toast.error("Simpan transaksi dulu untuk mencetak bukti");
    const w = window.open("", "_blank", "width=460,height=600");
    w.document.write(`
      <div style="font-family:sans-serif;padding:24px;max-width:380px;margin:auto;border:1px solid #cbd5e1;border-radius:12px;">
        <h2 style="margin:0;color:#065f46;text-align:center;">${settings.app_title || "ATH LIBRARY"}</h2>
        <p style="margin:2px 0 14px;text-align:center;font-size:12px;color:#64748b;">Bukti Peminjaman Buku</p>
        <hr/>
        <p style="font-size:13px;"><b>No. Transaksi:</b> ${d.trx_no}<br/>
        <b>Anggota:</b> ${d.member.name} (${d.member.member_no})<br/>
        <b>Tgl Pinjam:</b> ${formatDateID(d.loanDate)}<br/>
        <b>Jatuh Tempo:</b> ${formatDateID(d.dueDate)}</p>
        <table style="width:100%;font-size:12px;border-collapse:collapse;margin:10px 0;">
          <tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Kode</th><th style="text-align:left;padding:6px;">Judul</th></tr>
          ${d.books.map((b) => `<tr><td style="padding:6px;border-top:1px solid #e2e8f0;">${b.inventory_code}</td><td style="padding:6px;border-top:1px solid #e2e8f0;">${b.title}</td></tr>`).join("")}
        </table>
        <hr/>
        <p style="font-size:13px;"><b>Total Biaya:</b> ${rupiah(d.totalFee)} (${d.paid ? "Sudah Bayar - " + d.method : "Belum Bayar"})</p>
      </div>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-12">
        {/* Left: Peminjaman Baru Form */}
        <div className="card xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Plus size={18} className="rounded-full bg-emerald-700 p-0.5 text-white" /> Peminjaman Baru
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-800 dark:text-white">1. Pilih Anggota</div>
                <MemberPicker member={member} onSelect={setMember} onClear={() => setMember(null)} />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-800 dark:text-white">2. Tambah Buku (Cari / Scan QR)</div>
                <form onSubmit={scanOrSubmitCode} className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-10"
                      placeholder="Cari judul atau scan kode ATH-0001..."
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary !px-3" title="Cari / Tambah Kode (Scanner USB)">
                    <QrCode size={18} />
                  </button>
                  <button type="button" onClick={() => setCameraOpen(true)} className="btn btn-primary !px-3.5" title="Scan QR / Barcode via Kamera">
                    <Camera size={18} /> <span className="hidden sm:inline">Kamera</span>
                  </button>
                  {bookResults.length > 0 && (
                    <ul className="absolute left-0 top-full z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                      {bookResults.map((b) => (
                        <li
                          key={b.id}
                          onClick={() => addBookObj(b)}
                          className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700"
                        >
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white">{b.title}</div>
                            <div className="text-slate-400">{b.inventory_code} · {b.author}</div>
                          </div>
                          <span className={`badge ${b.available > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            Stok: {b.available}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>

                {/* Selected books mini-table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-800 text-white">
                      <tr>
                        <th className="px-3 py-2">Kode</th>
                        <th className="px-3 py-2">Judul Buku</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {books.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-400">Belum ada buku dipilih (maks. {maxBooks} buku)</td></tr>
                      ) : (
                        books.map((b) => (
                          <tr key={b.id}>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-800">{b.inventory_code}</td>
                            <td className="px-3 py-2 font-semibold">{b.title}</td>
                            <td className="px-3 py-2"><span className="badge bg-sky-100 text-sky-700">Dipinjam</span></td>
                            <td className="px-3 py-2 text-right">
                              <button className="text-rose-500 hover:text-rose-700" onClick={() => setBooks(books.filter((x) => x.id !== b.id))}>
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-5 border-t border-slate-100 pt-4 dark:border-slate-700 md:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-800 dark:text-white">3. Detail Peminjaman</div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="label">Tgl Pinjam</label>
                    <input type="date" className="input !px-2.5 text-xs" value={loanDate} onChange={(e) => setLoanDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Lama (hari)</label>
                    <input type="number" min={1} max={60} className="input text-center font-bold" value={days} onChange={(e) => setDays(Math.max(1, +e.target.value || 1))} />
                  </div>
                  <div>
                    <label className="label">Jatuh Tempo</label>
                    <input type="date" className="input !px-2.5 bg-slate-50 text-xs font-semibold" value={dueDate} readOnly />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-bold text-slate-800 dark:text-white">4. Pembayaran Peminjaman</div>
                <div className="grid grid-cols-3 gap-2.5 items-end">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div className="text-[11px] font-medium text-emerald-700">Total Biaya</div>
                    <div className="text-base font-extrabold text-emerald-900">{rupiah(totalFee)}</div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                      <input type="radio" checked={paid} onChange={() => setPaid(true)} className="text-emerald-700" /> Sudah Bayar
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                      <input type="radio" checked={!paid} onChange={() => setPaid(false)} className="text-amber-600" /> Belum Bayar
                    </label>
                  </div>
                  <div>
                    <label className="label">Metode</label>
                    <select className="input !py-2 text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="Tunai">Tunai</option>
                      <option value="Transfer">Transfer</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Catatan (Opsional)</label>
              <input className="input" placeholder="Contoh: Peminjaman sesuai ketentuan..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button className="btn btn-primary px-6" disabled={saving} onClick={saveLoan}>
                <CheckCircle2 size={17} /> {saving ? "Menyimpan..." : "Simpan Transaksi"}
              </button>
              <button className="btn btn-secondary" onClick={() => printReceipt()}>
                <Printer size={16} /> Cetak Bukti Peminjaman
              </button>
              <button className="btn btn-ghost" onClick={resetForm}>
                <X size={16} /> Bersihkan
              </button>
            </div>
          </div>
        </div>

        {/* Right: Ringkasan Transaksi + Ketentuan Peminjaman */}
        <div className="space-y-4 xl:col-span-4">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <BookOpen size={18} className="text-emerald-700" /> Ringkasan Transaksi
              </div>
            </div>
            <div className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Anggota</span><b className="text-right">{member ? `${member.name} (${member.member_no})` : "-"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Jumlah Buku</span><b>{books.length} eksemplar</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Jatuh Tempo</span><b>{formatDateID(dueDate)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Biaya</span><b className="text-emerald-800">{rupiah(totalFee)}</b></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status Bayar</span>
                <span className={`badge ${paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {paid ? "Sudah Bayar" : "Belum Bayar"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Info size={18} className="text-emerald-700" /> Ketentuan Peminjaman
              </div>
            </div>
            <ul className="space-y-2 p-5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Maksimal peminjaman: <b>{maxBooks} buku</b>.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Lama peminjaman default: <b>{defaultDays} hari</b>.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Biaya peminjaman: <b>{rupiah(loanFee)}/buku</b>.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Perpanjangan maksimal: <b>{maxExtend} kali</b>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom: Riwayat Transaksi Terbaru */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-emerald-950 dark:text-white">Riwayat Transaksi Terbaru</h3>
        <DataTable
          list={recent}
          placeholder="Cari transaksi terbaru..."
          columns={[
            { label: "Tanggal", render: (r) => formatDateID(r.loan_date) },
            { label: "No. Transaksi", render: (r) => <span className="font-mono text-xs font-bold">{r.trx_no}</span> },
            { label: "Anggota", render: (r) => <b>{r.member_name} <span className="text-xs font-normal text-slate-400">({r.member_no})</span></b> },
            { label: "Judul Buku", key: "titles" },
            { label: "Jml", key: "book_count" },
            { label: "Batas Kembali", render: (r) => formatDateID(r.due_date) },
            { label: "Status Bayar", render: (r) => <span className={`badge ${r.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{r.paid ? "Sudah Bayar" : "Belum Bayar"}</span> },
            {
              label: "Status Buku",
              render: (r) => (
                <span className={`badge ${r.display_status === "overdue" ? "bg-rose-100 text-rose-700" : r.display_status === "returned" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                  {r.display_status === "overdue" ? "Terlambat" : r.display_status === "returned" ? "Dikembalikan" : "Dipinjam"}
                </span>
              ),
            },
          ]}
        />
      </div>
      <QrScannerModal
        open={cameraOpen}
        allowContinuous
        title="Scan QR / Barcode Buku (Peminjaman)"
        subtitle="Arahkan kamera ke label QR (ATH-XXXX) atau barcode ISBN di belakang buku"
        onScan={lookupBookByCode}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

// ======================================================
// TAB 2: PENGEMBALIAN BUKU (Page 8)
// ======================================================
function ReturnTab() {
  const { settings } = useAuth();
  const finePerDay = Number(settings.fine_per_day) || 2000;

  const [member, setMember] = useState(null);
  const [scanCode, setScanCode] = useState("");
  const [items, setItems] = useState([]);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [finePaid, setFinePaid] = useState(true);
  const [method, setMethod] = useState("Tunai");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const returnedList = useList(E.LOANS.LIST, { status: "returned" });

  const loadMemberLoans = async (m) => {
    setMember(m);
    try {
      const { data } = await api.get(E.LOANS.ACTIVE_BY_MEMBER(m.id));
      setItems(data.data || []);
      if (!(data.data || []).length) toast("Anggota ini tidak memiliki pinjaman aktif");
    } catch { setItems([]); }
  };

  const lookupReturnByCode = async (rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code) return;
    try {
      const { data } = await api.get(E.LOANS.ACTIVE_BY_CODE(code));
      const hit = data.data;
      setScanCode("");
      await loadMemberLoans({ id: hit.member_id, name: hit.member_name, member_no: hit.member_no, level: hit.level, room: hit.room, photo: hit.photo });
      toast.success(`Ditemukan pinjaman milik ${hit.member_name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Buku "${code}" tidak sedang dipinjam`);
    }
  };

  const scanBookReturn = async (e) => {
    e.preventDefault();
    await lookupReturnByCode(scanCode);
  };

  const calcLate = (due) => Math.max(Math.ceil((new Date(returnDate) - new Date(due)) / 864e5), 0);
  const totalFine = items.reduce((sum, it) => sum + calcLate(it.due_date) * finePerDay, 0);

  const processReturn = async () => {
    if (!items.length) return toast.error("Tidak ada buku yang akan dikembalikan");
    setSaving(true);
    try {
      await request(
        (a) => a.post(E.LOANS.RETURN_BATCH, {
          items: items.map((i) => ({ loan_id: i.loan_id, book_id: i.book_id })),
          return_date: returnDate,
          fine_paid: finePaid,
          fine_payment_method: method,
          return_note: note,
        }),
        { success: "Pengembalian buku berhasil diproses!" }
      );
      setMember(null);
      setItems([]);
      setNote("");
      returnedList.reload();
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="card xl:col-span-8">
          <div className="card-header">
            <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
              <Undo2 size={18} className="text-emerald-700" /> Pengembalian Buku
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-bold">1. Pilih Anggota</div>
                <MemberPicker member={member} onSelect={loadMemberLoans} onClear={() => { setMember(null); setItems([]); }} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-bold">2. Pindai atau Masukkan Kode Buku</div>
                <form onSubmit={scanBookReturn} className="flex gap-2">
                  <input className="input" placeholder="Scan QR/ISBN atau ketik ATH-0001 lalu Enter..." value={scanCode} onChange={(e) => setScanCode(e.target.value)} />
                  <button type="submit" className="btn btn-secondary !px-3" title="Submit Kode (Scanner USB)"><QrCode size={18} /></button>
                  <button type="button" onClick={() => setCameraOpen(true)} className="btn btn-primary !px-3.5" title="Scan QR / Barcode via Kamera">
                    <Camera size={18} /> <span className="hidden sm:inline">Kamera</span>
                  </button>
                </form>
                <p className="text-[11px] text-slate-400">Otomatis mendeteksi peminjam aktif dari QR buku atau barcode ISBN.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-bold">3. Daftar Buku yang Dipinjam</div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-800 text-white">
                    <tr>
                      <th className="px-3 py-2.5">Kode</th>
                      <th className="px-3 py-2.5">Judul Buku</th>
                      <th className="px-3 py-2.5">Tgl Pinjam</th>
                      <th className="px-3 py-2.5">Jatuh Tempo</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Denda</th>
                      <th className="px-3 py-2.5 text-right">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-slate-400">Pilih anggota atau pindai QR buku yang dikembalikan</td></tr>
                    ) : (
                      items.map((it) => {
                        const late = calcLate(it.due_date);
                        const fine = late * finePerDay;
                        return (
                          <tr key={`${it.loan_id}-${it.book_id}`}>
                            <td className="px-3 py-2.5 font-mono font-bold text-emerald-800">{it.inventory_code}</td>
                            <td className="px-3 py-2.5 font-semibold">{it.title}</td>
                            <td className="px-3 py-2.5">{formatDateID(it.loan_date)}</td>
                            <td className="px-3 py-2.5">{formatDateID(it.due_date)}</td>
                            <td className="px-3 py-2.5">
                              {late > 0 ? (
                                <span className="badge bg-rose-100 text-rose-700">Terlambat ({late} hari)</span>
                              ) : (
                                <span className="badge bg-emerald-100 text-emerald-700">Tepat Waktu</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-rose-600">{rupiah(fine)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button className="text-rose-500 hover:text-rose-700" onClick={() => setItems(items.filter((x) => !(x.loan_id === it.loan_id && x.book_id === it.book_id)))}>
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900 sm:grid-cols-4 items-end">
              <div>
                <label className="label">Tanggal Pengembalian</label>
                <input type="date" className="input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
              <div>
                <div className="label">Total Denda</div>
                <div className="text-xl font-extrabold text-rose-600">{rupiah(totalFine)}</div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="label !mb-1">Pembayaran Denda</div>
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="radio" checked={finePaid} onChange={() => setFinePaid(true)} /> Sudah Bayar
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                  <input type="radio" checked={!finePaid} onChange={() => setFinePaid(false)} /> Belum Bayar
                </label>
              </div>
              <div>
                <label className="label">Metode Pembayaran</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer">Transfer</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Catatan Kondisi Buku (Opsional)</label>
              <input className="input" placeholder="Contoh: Buku dikembalikan dengan kondisi baik..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button className="btn btn-primary px-6" disabled={saving || !items.length} onClick={processReturn}>
                <Undo2 size={17} /> {saving ? "Memproses..." : "Proses Pengembalian"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMember(null); setItems([]); setNote(""); }}>
                <X size={16} /> Bersihkan
              </button>
            </div>
          </div>
        </div>

        {/* Right: Ringkasan Pengembalian + Ketentuan */}
        <div className="space-y-4 xl:col-span-4">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <BookOpen size={18} className="text-emerald-700" /> Ringkasan Pengembalian
              </div>
            </div>
            <div className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Anggota</span><b>{member ? `${member.name} (${member.member_no})` : "-"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Jumlah Buku</span><b>{items.length} buku</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="badge bg-emerald-100 text-emerald-700">Dikembalikan</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Denda</span><b className="text-rose-600">{rupiah(totalFine)}</b></div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Pembayaran</span>
                <span className={`badge ${finePaid || totalFine === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {totalFine === 0 ? "Tanpa Denda" : finePaid ? "Sudah Bayar" : "Belum Bayar"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2 font-bold text-emerald-950 dark:text-white">
                <Info size={18} className="text-emerald-700" /> Ketentuan Pengembalian
              </div>
            </div>
            <ul className="space-y-2 p-5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Kembalikan buku sesuai tanggal jatuh tempo.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Terlambat mengembalikan dikenakan denda.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Pastikan kondisi buku baik dan lengkap.</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Denda keterlambatan: <b>{rupiah(finePerDay)}/hari/buku</b>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom: Riwayat Pengembalian Terbaru */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-emerald-950 dark:text-white">Riwayat Pengembalian Terbaru</h3>
        <DataTable
          list={returnedList}
          placeholder="Cari riwayat pengembalian..."
          columns={[
            { label: "Tgl Kembali", render: (r) => formatDateID(r.return_date) },
            { label: "No. Transaksi", render: (r) => <span className="font-mono text-xs font-bold">{r.trx_no}</span> },
            { label: "Anggota", render: (r) => <b>{r.member_name} ({r.member_no})</b> },
            { label: "Judul Buku", key: "titles" },
            { label: "Jumlah", key: "book_count" },
            { label: "Denda", render: (r) => rupiah(r.fine) },
            { label: "Pembayaran", render: (r) => (Number(r.fine) > 0 ? <span className={`badge ${r.fine_paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{r.fine_paid ? "Sudah Bayar" : "Belum Bayar"}</span> : "-") },
            { label: "Status", render: () => <span className="badge bg-sky-100 text-sky-700">Selesai</span> },
          ]}
        />
      </div>
      <QrScannerModal
        open={cameraOpen}
        title="Scan QR / Barcode Buku (Pengembalian)"
        subtitle="Arahkan kamera ke label QR (ATH-XXXX) atau barcode ISBN buku yang dikembalikan"
        onScan={lookupReturnByCode}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

// ======================================================
// TAB 3: PERPANJANGAN PEMINJAMAN
// ======================================================
function ExtendTab() {
  const { settings } = useAuth();
  const extendDays = Number(settings.extend_days) || 7;
  const maxExtend = Number(settings.max_extend) || 1;
  const list = useList(E.LOANS.LIST, { status: "borrowed" });
  const [days, setDays] = useState(extendDays);

  const extendLoan = async (row) => {
    if (!(await confirmToast(`Perpanjang peminjaman ${row.trx_no} milik ${row.member_name} selama ${days} hari?`))) return;
    await request((a) => a.post(E.LOANS.EXTEND(row.id), { days }), { success: `Peminjaman diperpanjang ${days} hari` });
    list.reload();
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <h3 className="font-bold text-emerald-950 dark:text-white">Perpanjangan Masa Peminjaman</h3>
          <p className="text-xs text-slate-500">Pilih transaksi aktif untuk memperpanjang tanggal jatuh tempo (maksimal {maxExtend}x perpanjangan).</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Durasi Perpanjangan:</label>
          <select className="input w-32" value={days} onChange={(e) => setDays(+e.target.value)}>
            <option value={3}>3 Hari</option>
            <option value={7}>7 Hari</option>
            <option value={14}>14 Hari</option>
          </select>
        </div>
      </div>

      <DataTable
        list={list}
        placeholder="Cari no. transaksi atau nama anggota..."
        columns={[
          { label: "No. Transaksi", render: (r) => <span className="font-mono text-xs font-bold">{r.trx_no}</span> },
          { label: "Anggota", render: (r) => <b>{r.member_name} ({r.member_no})</b> },
          { label: "Buku", key: "titles" },
          { label: "Tgl Pinjam", render: (r) => formatDateID(r.loan_date) },
          { label: "Jatuh Tempo Saat Ini", render: (r) => <b className={r.display_status === "overdue" ? "text-rose-600" : "text-emerald-800"}>{formatDateID(r.due_date)}</b> },
          { label: "Jatuh Tempo Baru", render: (r) => <span className="font-semibold text-sky-700">{formatDateID(addDaysISO(r.due_date, days))}</span> },
          { label: "Diperpanjang", render: (r) => <span className="badge bg-slate-100 text-slate-700">{r.extend_count || 0} / {maxExtend}x</span> },
        ]}
        actions={(r) =>
          (r.extend_count || 0) < maxExtend ? (
            <button className="btn btn-primary btn-sm" onClick={() => extendLoan(r)}>
              <CalendarPlus size={14} /> Perpanjang +{days} Hr
            </button>
          ) : (
            <span className="badge bg-slate-100 text-slate-400">Batas Maksimal</span>
          )
        }
      />
    </div>
  );
}

// ======================================================
// TAB 4: RIWAYAT TRANSAKSI LENGKAP
// ======================================================
function HistoryTab() {
  const [filters, setFilters] = useState({ status: "", paid: "" });
  const list = useList(E.LOANS.LIST, filters);
  const [detail, setDetail] = useState(null);

  const openDetail = async (id) => {
    const { data } = await api.get(E.LOANS.DETAIL(id));
    setDetail(data.data);
  };

  const markPaid = async (row, type = "fee") => {
    if (!(await confirmToast(`Tandai ${type === "fine" ? "denda" : "biaya peminjaman"} ${row.trx_no} sebagai Sudah Bayar?`))) return;
    await request((a) => a.put(E.LOANS.PAY(row.id), { type }), { success: "Status pembayaran diperbarui menjadi Lunas" });
    list.reload();
  };

  return (
    <div className="space-y-4">
      <DataTable
        list={list}
        placeholder="Cari no. transaksi, nama, atau no. anggota..."
        filters={
          <>
            <select className="input w-36" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}>
              <option value="">Semua Status</option>
              <option value="borrowed">Dipinjam</option>
              <option value="overdue">Terlambat</option>
              <option value="returned">Dikembalikan</option>
            </select>
            <select className="input w-36" value={filters.paid} onChange={(e) => { setFilters((f) => ({ ...f, paid: e.target.value })); list.setParams((p) => ({ ...p, page: 1 })); }}>
              <option value="">Semua Bayar</option>
              <option value="1">Sudah Bayar</option>
              <option value="0">Belum Bayar</option>
            </select>
          </>
        }
        columns={[
          { label: "No. Transaksi", render: (r) => <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-300">{r.trx_no}</span> },
          { label: "Anggota", render: (r) => <b>{r.member_name} <span className="text-xs font-normal text-slate-400">({r.member_no})</span></b> },
          { label: "Judul Buku", key: "titles" },
          { label: "Tgl Pinjam", render: (r) => formatDateID(r.loan_date) },
          { label: "Jatuh Tempo", render: (r) => formatDateID(r.due_date) },
          { label: "Biaya", render: (r) => rupiah(r.fee) },
          { label: "Denda", render: (r) => rupiah(r.fine) },
          {
            label: "Pembayaran",
            render: (r) => (
              <span className={`badge ${r.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {r.paid ? "Sudah Bayar" : "Belum Bayar"}
              </span>
            ),
          },
          {
            label: "Status",
            render: (r) => (
              <span className={`badge ${r.display_status === "overdue" ? "bg-rose-100 text-rose-700" : r.display_status === "returned" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                {r.display_status === "overdue" ? "Terlambat" : r.display_status === "returned" ? "Dikembalikan" : "Dipinjam"}
              </span>
            ),
          },
        ]}
        actions={(r) => (
          <>
            {!r.paid && (
              <button className="btn btn-secondary btn-sm !px-2" title="Tandai Sudah Bayar" onClick={() => markPaid(r, "fee")}>
                <Wallet size={14} /> Bayar
              </button>
            )}
            <button className="btn btn-ghost btn-sm !px-2" title="Detail" onClick={() => openDetail(r.id)}>
              <Eye size={14} />
            </button>
          </>
        )}
      />

      <Modal open={!!detail} wide title={`Detail Transaksi ${detail?.trx_no || ""}`} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-900">
              <div><span className="text-slate-400">Anggota:</span> <b className="block">{detail.member_name} ({detail.member_no})</b></div>
              <div><span className="text-slate-400">Petugas:</span> <b className="block">{detail.officer_name}</b></div>
              <div><span className="text-slate-400">Tanggal Pinjam:</span> <b className="block">{formatDateID(detail.loan_date)}</b></div>
              <div><span className="text-slate-400">Jatuh Tempo:</span> <b className="block">{formatDateID(detail.due_date)}</b></div>
              <div><span className="text-slate-400">Tanggal Kembali:</span> <b className="block">{formatDateID(detail.return_date)}</b></div>
              <div><span className="text-slate-400">Biaya / Denda:</span> <b className="block">{rupiah(detail.fee)} / {rupiah(detail.fine)}</b></div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Daftar Buku</h4>
              <div className="divide-y rounded-xl border border-slate-200 dark:border-slate-700">
                {(detail.items || []).map((it) => (
                  <div key={it.book_id} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <div><b>{it.title}</b> <span className="text-slate-400">({it.inventory_code})</span></div>
                    <span className={`badge ${it.returned_at ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                      {it.returned_at ? `Kembali ${formatDateID(it.returned_at)}` : "Dipinjam"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {detail.note && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Catatan: {detail.note}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ======================================================
// MAIN TRANSACTIONS PAGE WRAPPER
// ======================================================
export default function Transactions() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = TABS.find((t) => location.pathname.includes(t.key))?.key || "peminjaman";

  return (
    <div className="space-y-5">
      {/* Header + Sub-tabs matching Pages 7 & 8 */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Transaksi Perpustakaan</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kelola peminjaman, pengembalian, perpanjangan, dan riwayat buku</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, path, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => navigate(path)}
              className={`btn ${activeKey === key ? "btn-primary shadow-md" : "btn-ghost"}`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeKey === "peminjaman" && <LoanTab />}
      {activeKey === "pengembalian" && <ReturnTab />}
      {activeKey === "perpanjangan" && <ExtendTab />}
      {activeKey === "riwayat" && <HistoryTab />}
    </div>
  );
}
