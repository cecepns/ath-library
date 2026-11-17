import { History, RotateCcw } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BOOK_COLUMNS } from "./Books";
import { useList } from "@/hooks/useList";
import { request } from "@/utils/request";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

export default function BookHistory() {
  const list = useList(E.BOOKS.LIST, { deleted: 1 });

  const restore = async (row) => {
    await request((a) => a.put(E.BOOKS.RESTORE(row.id)), { success: `"${row.title}" berhasil dipulihkan` });
    list.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
          <History size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Riwayat Buku Terhapus</h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Buku yang telah dihapus dari katalog aktif dapat dipulihkan kembali di sini</p>
        </div>
      </div>

      <DataTable
        list={list}
        columns={BOOK_COLUMNS.slice(0, 7)}
        placeholder="Cari buku terhapus..."
        actions={(r) => (
          <button className="btn btn-primary btn-sm" onClick={() => restore(r)}>
            <RotateCcw size={14} /> Pulihkan
          </button>
        )}
      />
    </div>
  );
}
