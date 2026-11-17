import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Books from "@/pages/Books";
import BookForm from "@/pages/BookForm";
import BookHistory from "@/pages/BookHistory";
import Categories from "@/pages/Categories";
import Shelves from "@/pages/Shelves";
import Members from "@/pages/Members";
import Transactions from "@/pages/Transactions";
import Visits from "@/pages/Visits";
import Reports from "@/pages/Reports";
import Procurement from "@/pages/Procurement";
import Settings from "@/pages/Settings";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eff5f1] dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Memuat ATH Library...</span>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/buku" element={<Books />} />
        <Route path="/buku/tambah" element={<BookForm />} />
        <Route path="/buku/edit/:id" element={<BookForm />} />
        <Route path="/riwayat-buku" element={<BookHistory />} />
        <Route path="/kategori" element={<Categories />} />
        <Route path="/rak" element={<Shelves />} />
        <Route path="/anggota" element={<Members />} />
        <Route path="/transaksi" element={<Navigate to="/transaksi/peminjaman" replace />} />
        <Route path="/transaksi/:tab" element={<Transactions />} />
        <Route path="/kunjungan" element={<Visits />} />
        <Route path="/laporan" element={<Navigate to="/laporan/koleksi" replace />} />
        <Route path="/laporan/:tab" element={<Reports />} />
        <Route path="/pengadaan" element={<Navigate to="/pengadaan/rencana" replace />} />
        <Route path="/pengadaan/:tab" element={<Procurement />} />
        <Route path="/pengaturan" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
