import { useEffect, useId, useRef, useState } from "react";
import { Camera, RefreshCw, Image as ImageIcon, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch { /* ignore audio block */ }
}

export default function QrScannerModal({
  open,
  title = "Scan QR / Barcode Kamera",
  subtitle = "Arahkan kamera ke kode QR buku (ATH-XXXX) atau barcode ISBN",
  allowContinuous = false,
  onScan,
  onClose,
}) {
  const regionId = "ath-qr-reader-" + useId().replace(/:/g, "");
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: "", time: 0 });
  const fileInputRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [lastCode, setLastCode] = useState("");
  const [continuous, setContinuous] = useState(false);

  const stopScanner = async () => {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) await inst.stop();
      await inst.clear();
    } catch { /* noop */ }
    scannerRef.current = null;
  };

  // Discover cameras on open
  useEffect(() => {
    if (!open) {
      stopScanner();
      setLastCode("");
      setError("");
      return;
    }

    let cancelled = false;
    setError("");
    setStarting(true);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (!devices || devices.length === 0) {
          setError("Kamera tidak terdeteksi di perangkat ini. Anda tetap dapat menggunakan fitur 'Scan dari Gambar'.");
          setStarting(false);
          return;
        }
        setCameras(devices);
        const rear = devices.find((d) => /back|rear|environment|belakang/i.test(d.label));
        setCameraId((prev) => prev || rear?.id || devices[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = String(err?.message || err || "");
        if (/permission|denied|notallowed/i.test(msg)) {
          setError("Izin kamera ditolak oleh browser. Klik ikon gembok/kamera di address bar untuk mengizinkan akses kamera.");
        } else {
          setError("Tidak dapat mengakses kamera. Pastikan menggunakan localhost/HTTPS dan tidak ada aplikasi lain yang memakai kamera.");
        }
        setStarting(false);
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open]);

  // Start scanner when cameraId is ready
  useEffect(() => {
    if (!open || !cameraId) return;
    let active = true;

    const start = async () => {
      await stopScanner();
      if (!active) return;
      setStarting(true);
      setError("");

      try {
        const html5Qr = new Html5Qrcode(regionId, { formatsToSupport: FORMATS, verbose: false });
        scannerRef.current = html5Qr;

        await html5Qr.start(
          cameraId,
          { fps: 12, qrbox: { width: 250, height: 180 }, aspectRatio: 1.333 },
          async (decodedText) => {
            const code = String(decodedText || "").trim();
            if (!code) return;
            const now = Date.now();
            // Cooldown 1.8s for same code to prevent duplicate rapid fires
            if (lastScanRef.current.code === code && now - lastScanRef.current.time < 1800) return;
            lastScanRef.current = { code, time: now };

            playBeep();
            setLastCode(code);
            await onScan?.(code);

            if (!continuous) {
              await stopScanner();
              onClose?.();
            }
          },
          () => {}
        );
      } catch (err) {
        if (active) setError("Gagal memulai kamera: " + (err?.message || "Periksa izin kamera"));
      } finally {
        if (active) setStarting(false);
      }
    };

    start();
    return () => {
      active = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cameraId, continuous]);

  const handleScanImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      await stopScanner();
      const reader = new Html5Qrcode(regionId, { formatsToSupport: FORMATS, verbose: false });
      const result = await reader.scanFile(file, false);
      await reader.clear();
      const code = String(result || "").trim();
      if (code) {
        playBeep();
        setLastCode(code);
        await onScan?.(code);
        if (!continuous) onClose?.();
      }
    } catch {
      setError("QR Code / Barcode tidak terbaca pada gambar tersebut. Pastikan gambar jelas & tidak buram.");
    } finally {
      e.target.value = "";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-800 px-5 py-4 text-white dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Camera size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold leading-tight">{title}</h3>
              <p className="text-[11px] text-emerald-100">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Camera Selector & Continuous Mode */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {cameras.length > 1 ? (
              <div className="flex flex-1 items-center gap-2">
                <RefreshCw size={15} className="shrink-0 text-emerald-700" />
                <select
                  className="input !py-1.5 text-xs"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Kamera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                Mendukung QR Code & Barcode (ISBN / Code 128)
              </span>
            )}

            {allowContinuous && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                <input
                  type="checkbox"
                  checked={continuous}
                  onChange={(e) => setContinuous(e.target.checked)}
                  className="accent-emerald-700"
                />
                Scan Beruntun
              </label>
            )}
          </div>

          {/* Live Camera Viewport */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-slate-950 dark:border-emerald-800">
            <div id={regionId} className="min-h-[260px] w-full" />
            {starting && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-300/30 border-t-emerald-400" />
                <span className="text-xs font-medium">Menyalakan kamera...</span>
              </div>
            )}
          </div>

          {lastCode && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              Terdeteksi: <span className="font-mono font-extrabold">{lastCode}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanImage} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={15} /> Scan dari Gambar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
