import toast from "react-hot-toast";
import { api } from "./api";

// Helper request reusable: tangani toast sukses/error di satu tempat
export async function request(fn, { success } = {}) {
  try {
    const res = await fn(api);
    if (success) toast.success(success);
    return res.data;
  } catch (e) {
    toast.error(e.response?.data?.message || "Terjadi kesalahan");
    throw e;
  }
}
