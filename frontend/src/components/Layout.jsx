import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, BedDouble, ArrowLeftRight, CalendarCheck,
  BarChart3, ShoppingCart, Settings, Menu, ChevronDown, Bell, LogOut,
  KeyRound, AlertTriangle, Wallet, PackagePlus, ShieldCheck, X,
} from "lucide-react";
import toast from "react-hot-toast";
import BrandLogo from "./BrandLogo";
import Modal from "./Modal";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/utils/api";
import { API_ENDPOINTS as E } from "@/utils/endpoints";
import { request } from "@/utils/request";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard },
  {
    key: "books",
    label: "Data Buku",
    icon: BookOpen,
    match: ["/buku", "/kategori", "/rak", "/riwayat-buku"],
    children: [
      { label: "Daftar Buku", to: "/buku" },
      { label: "Tambah Buku", to: "/buku/tambah" },
      { label: "Kategori Buku", to: "/kategori" },
      { label: "Rak Buku", to: "/rak" },
      { label: "Riwayat Terhapus", to: "/riwayat-buku" },
    ],
  },
  { key: "members", label: "Data Anggota", to: "/anggota", icon: Users },
  { key: "rooms", label: "Data Kamar", to: "/kamar", icon: BedDouble },
  {
    key: "transactions",
    label: "Transaksi",
    icon: ArrowLeftRight,
    match: ["/transaksi"],
    children: [
      { label: "Peminjaman Buku", to: "/transaksi/peminjaman" },
      { label: "Pengembalian Buku", to: "/transaksi/pengembalian" },
      { label: "Perpanjangan", to: "/transaksi/perpanjangan" },
      { label: "Riwayat Transaksi", to: "/transaksi/riwayat" },
    ],
  },
  { key: "visits", label: "Kunjungan", to: "/kunjungan", icon: CalendarCheck },
  {
    key: "reports",
    label: "Laporan",
    icon: BarChart3,
    match: ["/laporan"],
    children: [
      { label: "Laporan Koleksi", to: "/laporan/koleksi" },
      { label: "Laporan Transaksi", to: "/laporan/transaksi" },
      { label: "Laporan Kunjungan", to: "/laporan/kunjungan" },
      { label: "Laporan Anggota", to: "/laporan/anggota" },
      { label: "Laporan Keuangan", to: "/laporan/keuangan" },
    ],
  },
  {
    key: "procurement",
    label: "Pengadaan Buku",
    icon: ShoppingCart,
    match: ["/pengadaan"],
    children: [
      { label: "Rencana Pengadaan", to: "/pengadaan/rencana" },
      { label: "Pembelian", to: "/pengadaan/pembelian" },
      { label: "Donasi", to: "/pengadaan/donasi" },
      { label: "Riwayat Pengadaan", to: "/pengadaan/riwayat" },
    ],
  },
  { key: "settings", label: "Pengaturan", to: "/pengaturan", icon: Settings },
];

export default function Layout() {
  const { user, settings, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({ books: true, transactions: true });
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [alerts, setAlerts] = useState({ overdue: 0, unpaid: 0, pending_procurements: 0 });
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Auto-open the parent accordion of the active route
  useEffect(() => {
    for (const item of NAV_ITEMS) {
      if (item.match?.some((m) => location.pathname.startsWith(m))) {
        setOpenMenus((prev) => ({ ...prev, [item.key]: true }));
      }
    }
  }, [location.pathname]);

  // Fetch notification summary
  useEffect(() => {
    api.get(E.DASHBOARD).then(({ data }) => {
      if (data?.data) {
        setAlerts({
          overdue: Number(data.data.overdue || 0),
          unpaid: Number(data.data.unpaid || 0),
          pending_procurements: Number(data.data.pending_procurements || 0),
        });
      }
    }).catch(() => {});
  }, [location.pathname]);

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const totalAlerts = alerts.overdue + alerts.unpaid + alerts.pending_procurements;

  const isParentActive = (item) =>
    item.match ? item.match.some((m) => location.pathname === m || location.pathname.startsWith(m + "/")) : location.pathname === item.to;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm) return toast.error("Konfirmasi password tidak cocok");
    setSavingPwd(true);
    try {
      await request((a) => a.put(E.AUTH.CHANGE_PASSWORD, { old_password: pwdForm.old_password, new_password: pwdForm.new_password }), {
        success: "Password berhasil diperbarui",
      });
      setPwdModal(false);
      setPwdForm({ old_password: "", new_password: "", confirm: "" });
    } catch { /* toast handled */ } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#eff5f1] text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-[#054e38] via-[#065f46] to-[#023828] text-white shadow-2xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${desktopCollapsed ? "lg:w-0 lg:overflow-hidden" : "w-72"}`}
      >
        {/* Brand Header */}
        <div className="relative flex flex-col items-center border-b border-white/10 px-5 pb-5 pt-6 text-center">
          <button
            className="absolute right-3 top-3 rounded-lg p-1.5 text-emerald-100 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
          <BrandLogo size={64} logoFile={settings.logo} />
          <div className="mt-2.5 text-xl font-extrabold tracking-wide text-white">
            {settings.app_title || "ATH LIBRARY"}
          </div>
          <div className="text-xs font-medium text-emerald-200/90">
            {settings.library_name || "Perpustakaan Attholibiyah"}
          </div>
        </div>

        {/* Navigation Links — Larger font size as requested */}
        <nav className="relative z-10 flex-1 space-y-1.5 overflow-y-auto px-3.5 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isParentActive(item);
            if (!item.children) {
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 rounded-xl px-4 py-3 text-[16px] font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-white text-emerald-900 shadow-lg shadow-emerald-950/20"
                        : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <Icon size={22} strokeWidth={2.1} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            }

            const expanded = !!openMenus[item.key];
            return (
              <div key={item.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenMenus((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-[16px] font-semibold transition-all duration-150 ${
                    active
                      ? "bg-white text-emerald-900 shadow-lg shadow-emerald-950/20"
                      : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3.5 truncate">
                    <Icon size={22} strokeWidth={2.1} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown
                    size={19}
                    className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  />
                </button>

                {expanded && (
                  <div className="ml-3 space-y-1 border-l-2 border-emerald-400/25 pl-3 pt-0.5">
                    {item.children.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end={sub.to === "/buku"}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15px] transition-all ${
                            isActive
                              ? "bg-emerald-500/35 font-bold text-white shadow-inner ring-1 ring-emerald-300/30"
                              : "font-medium text-emerald-100/80 hover:bg-white/10 hover:text-white"
                          }`
                        }
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                        <span className="truncate">{sub.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP HEADER */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-emerald-900/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95 lg:px-6">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => (window.innerWidth >= 1024 ? setDesktopCollapsed((c) => !c) : setMobileOpen(true))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/10 bg-emerald-50/70 text-emerald-800 transition hover:bg-emerald-100 dark:border-slate-600 dark:bg-slate-700 dark:text-emerald-300"
              title="Toggle Sidebar"
            >
              <Menu size={21} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-emerald-900 dark:text-emerald-300 sm:text-xl">
                {settings.app_title || "ATH LIBRARY"}
              </h1>
              <p className="hidden truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                {settings.app_subtitle || "Sistem Administrasi Perpustakaan PP Attholibiyah"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                title="Notifikasi"
              >
                <Bell size={20} />
                {totalAlerts > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800">
                    {totalAlerts > 99 ? "99+" : totalAlerts}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                  <div className="border-b border-slate-100 bg-emerald-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/50">
                    <div className="text-sm font-bold text-emerald-950 dark:text-white">Pengingat & Notifikasi</div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    <button
                      onClick={() => { setNotifOpen(false); navigate("/transaksi/pengembalian"); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle size={18} /></span>
                      <div className="text-xs">
                        <div className="font-bold text-slate-800 dark:text-white">{alerts.overdue} transaksi terlambat</div>
                        <div className="text-slate-500">Perlu segera ditindaklanjuti</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setNotifOpen(false); navigate("/transaksi/riwayat"); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Wallet size={18} /></span>
                      <div className="text-xs">
                        <div className="font-bold text-slate-800 dark:text-white">{alerts.unpaid} transaksi belum dibayar</div>
                        <div className="text-slate-500">Cek status pembayaran peminjaman</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setNotifOpen(false); navigate("/pengadaan/rencana"); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><PackagePlus size={18} /></span>
                      <div className="text-xs">
                        <div className="font-bold text-slate-800 dark:text-white">{alerts.pending_procurements} usulan pengadaan buku</div>
                        <div className="text-slate-500">Tinjau rencana pengadaan aktif</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-600 dark:bg-slate-700"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-sm font-bold text-white shadow-sm">
                  {(user?.name || "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden leading-tight sm:block">
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{user?.name || "Admin Perpustakaan"}</div>
                  <div className="text-xs font-medium capitalize text-emerald-700 dark:text-emerald-300">
                    {user?.role === "administrator" ? "Administrator" : "Petugas"}
                  </div>
                </div>
                <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                  <div className="border-b border-slate-100 bg-emerald-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/40">
                    <div className="text-sm font-bold text-slate-800 dark:text-white">{user?.name}</div>
                    <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck size={13} /> @{user?.username}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); setPwdModal(true); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <KeyRound size={16} /> Ubah Password
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); navigate("/pengaturan"); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Settings size={16} /> Pengaturan Sistem
                    </button>
                    <hr className="my-1 border-slate-100 dark:border-slate-700" />
                    <button
                      onClick={() => { setProfileOpen(false); logout(); navigate("/login"); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <LogOut size={16} /> Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      <Modal open={pwdModal} title="Ubah Password Akun" onClose={() => setPwdModal(false)}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Password Lama</label>
            <input type="password" className="input" required value={pwdForm.old_password} onChange={(e) => setPwdForm({ ...pwdForm, old_password: e.target.value })} />
          </div>
          <div>
            <label className="label">Password Baru (min. 6 karakter)</label>
            <input type="password" className="input" required minLength={6} value={pwdForm.new_password} onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })} />
          </div>
          <div>
            <label className="label">Konfirmasi Password Baru</label>
            <input type="password" className="input" required value={pwdForm.confirm} onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setPwdModal(false)}>Batal</button>
            <button className="btn btn-primary" disabled={savingPwd}>{savingPwd ? "Menyimpan..." : "Simpan Password"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
