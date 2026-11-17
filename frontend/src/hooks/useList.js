import { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import { useDebounce } from "./useDebounce";

// Pagination, search (debounce 300ms) dan limit semuanya dari API backend
export function useList(endpoint, extra = {}) {
  const [state, setState] = useState({ data: [], pagination: { page: 1, totalPages: 1, total: 0 }, loading: true, error: null });
  const [params, setParams] = useState({ page: 1, limit: 10, search: "" });
  const search = useDebounce(params.search, 300);
  const extraKey = JSON.stringify(extra);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get(endpoint, { params: { ...JSON.parse(extraKey), page: params.page, limit: params.limit, search } });
      setState({ data: data.data, pagination: data.pagination, loading: false, error: null });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Gagal memuat data" }));
    }
  }, [endpoint, params.page, params.limit, search, extraKey]);

  useEffect(() => { load(); }, [load]);
  return { ...state, params, setParams, reload: load };
}
