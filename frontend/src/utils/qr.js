import QRCode from "qrcode";

export async function makeQrDataUrl(text, width = 260) {
  if (!text) return "";
  try {
    return await QRCode.toDataURL(String(text), { width, margin: 1 });
  } catch {
    return "";
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Unduh 1 label QR sebagai file gambar PNG siap cetak/kirim
export async function downloadQrLabelPng({ code, title = "", header = "ATH LIBRARY" }) {
  if (!code) return;
  const qrUrl = await makeQrDataUrl(code, 380);
  const qrImg = await loadImage(qrUrl);

  const W = 540, H = 640;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // White card background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Dashed emerald border
  ctx.strokeStyle = "#065f46";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.setLineDash([]);

  // Header
  ctx.fillStyle = "#065f46";
  ctx.font = "800 26px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(header, W / 2, 74);

  // QR image
  ctx.drawImage(qrImg, (W - 360) / 2, 98, 360, 360);

  // Code
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 32px monospace";
  ctx.fillText(String(code), W / 2, 505);

  // Title (up to 2 lines)
  if (title) {
    ctx.fillStyle = "#475569";
    ctx.font = "600 21px 'Plus Jakarta Sans', sans-serif";
    const lines = wrapText(ctx, title, W - 80, 2);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 548 + i * 28));
  }

  triggerDownload(canvas.toDataURL("image/png"), `QR-${String(code).replace(/[^a-zA-Z0-9_-]/g, "")}.png`);
}

// Unduh lembaran label QR massal (grid 3 kolom) sebagai PNG
export async function downloadBatchQrSheetPng(items = [], header = "ATH LIBRARY") {
  if (!items.length) return;
  const cols = 3;
  const rows = Math.ceil(items.length / cols);
  const cardW = 340, cardH = 400, gap = 24, pad = 28;
  const canvas = document.createElement("canvas");
  canvas.width = pad * 2 + cols * cardW + (cols - 1) * gap;
  canvas.height = pad * 2 + rows * cardH + (rows - 1) * gap;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (cardW + gap);
    const y = pad + row * (cardH + gap);

    ctx.strokeStyle = "#065f46";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.setLineDash([]);

    ctx.fillStyle = "#065f46";
    ctx.font = "800 18px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(header, x + cardW / 2, y + 34);

    const url = it.dataUrl || (await makeQrDataUrl(it.code, 220));
    const img = await loadImage(url);
    ctx.drawImage(img, x + (cardW - 210) / 2, y + 50, 210, 210);

    ctx.fillStyle = "#0f172a";
    ctx.font = "800 22px monospace";
    ctx.fillText(String(it.code || ""), x + cardW / 2, y + 296);

    ctx.fillStyle = "#475569";
    ctx.font = "600 15px 'Plus Jakarta Sans', sans-serif";
    const lines = wrapText(ctx, it.title || "", cardW - 36, 2);
    lines.forEach((l, i) => ctx.fillText(l, x + cardW / 2, y + 328 + i * 21));
  }

  triggerDownload(canvas.toDataURL("image/png"), `Label-QR-${header.replace(/\s+/g, "-")}.png`);
}
