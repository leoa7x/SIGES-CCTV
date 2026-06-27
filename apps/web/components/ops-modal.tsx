"use client";

import { ReactNode, useEffect } from "react";

export function OpsModal({
  open,
  title,
  onClose,
  saving,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  saving?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-ops border border-ops-border bg-ops-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ops-border px-5 py-4">
          <h2 className="font-semibold text-ops-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ops-muted hover:text-ops-text"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
