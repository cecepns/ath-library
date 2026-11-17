import { fileUrl } from "@/utils/api";

export default function BrandLogo({ size = 56, logoFile }) {
  if (logoFile) {
    return (
      <img
        src={fileUrl(logoFile)}
        alt="ATH Library"
        style={{ width: size, height: size }}
        className="rounded-xl object-contain bg-white/10 p-1"
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-md">
      {/* Green A-shaped archway */}
      <path d="M50 8L14 78H31L50 38L69 78H86L50 8Z" fill="url(#athGreen)" stroke="#f8fafc" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Gold crescent / inner dome accent */}
      <path d="M50 26C43 33 41 44 45 53C41 49 38 42 40 34C41 29 45 26 50 26Z" fill="#facc15" />
      {/* Open book at bottom */}
      <path d="M18 68C28 63 40 65 50 74C60 65 72 63 82 68V84C72 79 60 80 50 88C40 80 28 79 18 84V68Z" fill="#ffffff" stroke="#065f46" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 74V88" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" />
      {/* Gold ribbon beneath book */}
      <path d="M12 85C28 94 72 94 88 85" stroke="url(#athGold)" strokeWidth="4.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="athGreen" x1="50" y1="8" x2="50" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="athGold" x1="12" y1="88" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#fde047" />
        </linearGradient>
      </defs>
    </svg>
  );
}
