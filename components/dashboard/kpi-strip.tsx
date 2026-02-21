type KpiStripProps = {
  kpis: Array<{ label: string; value: string; delta?: string }>;
};

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <article key={kpi.label} className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">{kpi.label}</p>
          <p className="mt-2 font-monoData text-xl font-semibold text-white">{kpi.value}</p>
          {kpi.delta ? <p className="mt-1 text-xs text-white/55">{kpi.delta}</p> : null}
        </article>
      ))}
    </section>
  );
}
