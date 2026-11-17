import QRCode from "qrcode";

export async function makeQrDataUrl(text, width = 260) {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(String(text), { width, margin: 1 });
  } catch {
    return "";
  }
}
