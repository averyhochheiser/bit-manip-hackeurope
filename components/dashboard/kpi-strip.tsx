type KpiStripProps = {
  kpis: Array<{ label: string; value: string; delta?: string }>;
};

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <article
          key={kpi.label}
          className="rounded border-[0.5px] border-border-subtle bg-canvas-raised px-6 py-8"
        >
          <p className="text-[10px] uppercase tracking-widest text-ink-muted">
            {kpi.label}
          </p>
          <p className="mt-4 font-mono text-2xl font-light text-ink">
            {kpi.value}
          </p>
          {kpi.delta ? (
            <p className="mt-2 text-xs font-light text-ink-muted">
              {kpi.delta}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
