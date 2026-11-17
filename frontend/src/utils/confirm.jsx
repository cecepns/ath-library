import toast from "react-hot-toast";

export const confirmToast = (message) =>
  new Promise((resolve) => {
    toast(
      (t) => (
        <div className="min-w-[240px] space-y-3">
          <p className="text-sm font-medium text-slate-700">{message}</p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => { toast.dismiss(t.id); resolve(false); }}>
              Batal
            </button>
            <button className="btn btn-sm bg-rose-600 text-white hover:bg-rose-700" onClick={() => { toast.dismiss(t.id); resolve(true); }}>
              Ya, lanjut
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  });

export const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (dateStr, days) => {
  const d = new Date(dateStr || todayISO());
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function formatDateID(iso) {
  if (!iso) return "-";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTodayHeader() {
  const d = new Date();
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}
