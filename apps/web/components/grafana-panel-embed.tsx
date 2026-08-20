type GrafanaPanelEmbedProps = {
  title: string;
  src: string | null;
  loading?: boolean;
  iframeClassName?: string;
};

export function GrafanaPanelEmbed({ title, src, loading = false, iframeClassName = "h-[720px]" }: GrafanaPanelEmbedProps) {
  if (loading) {
    return (
      <div className="rounded-ops border border-ops-border bg-ops-panel p-4 text-sm text-ops-muted">
        Cargando observabilidad...
      </div>
    );
  }

  if (!src) {
    return (
      <div className="rounded-ops border border-ops-border bg-ops-panel p-4 text-sm text-ops-muted">
        Observabilidad no disponible.
      </div>
    );
  }

  return (
    <section className="rounded-ops border border-ops-border bg-ops-panel p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ops-muted">{title}</p>
      <iframe
        title={title}
        className={`${iframeClassName} w-full rounded-ops border border-ops-border bg-black`}
        src={src}
        loading="lazy"
      />
    </section>
  );
}
