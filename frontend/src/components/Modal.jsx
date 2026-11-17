import { X } from "lucide-react";

export default function Modal({ open, title, onClose, children, wide, xl }) {
  if (!open) return null;
  const maxW = xl ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800 ${maxW}`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-emerald-50/70 px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-base font-bold text-emerald-950 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
