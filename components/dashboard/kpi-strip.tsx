type KpiStripProps = {
  kpis: Array<{ label: string; value: string; delta?: string }>;
};

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 w-full">
      {kpis.map((kpi, index) => (
        <article
          key={kpi.label}
          className={`relative flex flex-col justify-end bg-canvas-raised p-6 lg:p-8 ${index !== kpis.length - 1 ? "border-b-[0.5px] border-border-subtle xl:border-b-0 xl:border-r-[0.5px]" : ""
            }`}
          style={{ minHeight: "160px" }}
        >
          <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-8 lg:top-8">
            {kpi.label}
          </p>
          <div className="mt-auto">
            <p className="font-mono text-2xl font-light text-ink">
              {kpi.value}
            </p>
            {kpi.delta ? (
              <p className="mt-2 text-xs font-light text-ink-muted">
                {kpi.delta}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
