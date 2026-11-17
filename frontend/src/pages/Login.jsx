import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, LogIn, BookOpen, QrCode, BarChart3, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";

const HIGHLIGHTS = [
  { icon: BookOpen, title: "Katalog & Manajemen Rak", desc: "Kelola ribuan koleksi kitab, buku pelajaran & label QR inventaris." },
  { icon: QrCode, title: "Sirkulasi & Scan QR Cepat", desc: "Peminjaman, pengembalian, perpanjangan & kalkulasi denda otomatis." },
  { icon: BarChart3, title: "Laporan & Pengadaan Lengkap", desc: "Pantau kunjungan santri, keuangan perpustakaan, pembelian & donasi." },
];

export default function Login() {
  const { login, settings } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return toast.error("Masukkan username dan password");
    setSubmitting(true);
    try {
      const u = await login({ username: username.trim(), password, remember });
      toast.success(`Selamat datang, ${u.name}!`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Login gagal, periksa akun Anda");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#e7f4ec] via-[#f4f9f6] to-[#d9efe2] p-4 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950">
      {/* Subtle decorative orbs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-2xl shadow-emerald-950/10 dark:border-slate-700 dark:bg-slate-800 lg:grid-cols-12">
        {/* LEFT BRAND PANEL */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#044e37] via-[#065f46] to-[#023525] p-8 text-white lg:col-span-6 lg:p-10">
          {/* Decorative geometric pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="islamicGrid" width="44" height="44" patternUnits="userSpaceOnUse">
                  <path d="M22 0L44 22L22 44L0 22Z" fill="none" stroke="#ffffff" strokeWidth="1" />
                  <circle cx="22" cy="22" r="5" fill="none" stroke="#facc15" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#islamicGrid)" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur-sm">
                <BrandLogo size={54} logoFile={settings.logo} />
              </div>
              <div>
                <div className="text-2xl font-extrabold tracking-wide">{settings.app_title || "ATH LIBRARY"}</div>
                <div className="text-xs font-medium text-emerald-200">{settings.library_name || "Perpustakaan Attholibiyah"}</div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
                <Sparkles size={13} /> Sistem Administrasi Digital Terpadu
              </span>
              <h2 className="text-2xl font-extrabold leading-snug sm:text-3xl">
                Kelola Perpustakaan Pesantren Lebih Mudah, Cepat & Modern
              </h2>
              <p className="text-sm leading-relaxed text-emerald-100/85">
                {settings.institution_name || "Pondok Pesantren Attholibiyah"} — {settings.address || "Bumijawa, Tegal, Jawa Tengah"}
              </p>
            </div>

            <div className="mt-7 space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{title}</div>
                    <div className="text-xs text-emerald-100/80">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-8 border-t border-white/15 pt-4 text-xs text-emerald-200/80">
            © {new Date().getFullYear()} {settings.app_title || "ATH LIBRARY"} · {settings.institution_name || "PP Attholibiyah"}
          </div>
        </div>

        {/* RIGHT LOGIN FORM PANEL */}
        <div className="flex flex-col justify-center p-8 lg:col-span-6 lg:p-12">
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-emerald-950 dark:text-white">Masuk ke Panel Admin</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Silakan masuk menggunakan akun petugas atau administrator perpustakaan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label text-sm">Username</label>
              <div className="relative">
                <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-11 py-3 text-sm"
                  placeholder="Masukkan username (mis. admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label text-sm">Password</label>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  className="input pl-11 pr-11 py-3 text-sm"
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                />
                Ingat saya (Remember Me)
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full py-3.5 text-base shadow-lg shadow-emerald-900/20"
            >
              <LogIn size={19} />
              {submitting ? "Memverifikasi..." : "Masuk Sekarang"}
            </button>
          </form>

          {/* Quick Demo Account Selector */}
          <div className="mt-7 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/40">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Akun Default Tersedia
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setUsername("admin"); setPassword("admin123"); }}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="font-bold text-emerald-900 dark:text-emerald-300">Administrator</div>
                <div className="text-slate-500">admin / admin123</div>
              </button>
              <button
                type="button"
                onClick={() => { setUsername("petugas1"); setPassword("petugas123"); }}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="font-bold text-emerald-900 dark:text-emerald-300">Petugas</div>
                <div className="text-slate-500">petugas1 / petugas123</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
