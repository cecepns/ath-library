import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getStoredToken, TOKEN_KEY } from "@/utils/api";
import { API_ENDPOINTS as E } from "@/utils/endpoints";

const AuthContext = createContext(null);

const FALLBACK_SETTINGS = {
  app_title: "ATH LIBRARY",
  app_subtitle: "Sistem Administrasi Perpustakaan PP Attholibiyah",
  library_name: "Perpustakaan Attholibiyah",
  institution_name: "Pondok Pesantren Attholibiyah",
  address: "Bumijawa, Tegal, Jawa Tengah",
  phone: "0812-3456-7890",
  email: "perpustakaan@attholibiyah.sch.id",
  logo: "",
  mode: "light",
  max_books: "3",
  loan_days: "14",
  loan_fee: "2000",
  max_extend: "1",
  extend_days: "7",
  fine_per_day: "2000",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);

  const applyMode = useCallback((mode) => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, []);

  const loadSettings = useCallback(async (authenticated) => {
    try {
      const { data } = await api.get(authenticated ? E.SETTINGS.GET : E.SETTINGS.PUBLIC);
      const next = authenticated ? data.data.settings : data.data;
      setSettings((prev) => {
        const merged = { ...prev, ...next };
        applyMode(merged.mode);
        return merged;
      });
    } catch { /* keep fallback */ }
  }, [applyMode]);

  useEffect(() => {
    const init = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const { data } = await api.get(E.AUTH.ME);
          setUser(data.data);
          await loadSettings(true);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
          await loadSettings(false);
        }
      } else {
        await loadSettings(false);
      }
      setLoading(false);
    };
    init();

    const onUnauthorized = () => setUser(null);
    window.addEventListener("ath:unauthorized", onUnauthorized);
    return () => window.removeEventListener("ath:unauthorized", onUnauthorized);
  }, [loadSettings]);

  const login = async ({ username, password, remember }) => {
    const { data } = await api.post(E.AUTH.LOGIN, { username, password, remember });
    const { token, user: u } = data.data;
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    setUser(u);
    await loadSettings(true);
    return u;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const updateLocalSettings = (next) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      applyMode(merged.mode);
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, settings, login, logout, reloadSettings: () => loadSettings(!!user), updateLocalSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
