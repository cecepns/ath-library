import axios from "axios";

export const TOKEN_KEY = "ath_library_token";

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "https://api.kingcreativestudio.my.id/ath-library/api" });

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("ath:unauthorized"));
    }
    return Promise.reject(err);
  }
);

export const fileUrl = (name) => (name ? `${import.meta.env.VITE_FILE_URL || "https://api.kingcreativestudio.my.id/ath-library/uploads"}/${name}` : null);
