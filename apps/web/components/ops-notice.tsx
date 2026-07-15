type OpsNoticeProps = {
  tone?: "info" | "warning" | "error";
  title: string;
  message: string;
  onDismiss?: () => void;
};

const TONE_CLASS: Record<NonNullable<OpsNoticeProps["tone"]>, string> = {
  info: "border-ops-blue/30 bg-ops-blue/10 text-ops-blue",
  warning: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  error: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
};

export function OpsNotice({
  tone = "info",
  title,
  message,
  onDismiss,
}: OpsNoticeProps) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-ops border px-4 py-3 ${TONE_CLASS[tone]}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
        <p className="mt-1 text-sm leading-5">{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] hover:bg-black/10"
        >
          Cerrar
        </button>
      ) : null}
    </div>
  );
}
