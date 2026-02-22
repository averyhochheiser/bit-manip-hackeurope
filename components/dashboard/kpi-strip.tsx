"use client";

import type { KpiItem } from "@/lib/dashboard/types";

type KpiStripProps = {
  kpis: KpiItem[];
};

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <article
          key={kpi.label}
          className="panel-muted flex flex-col justify-between p-5 min-h-[120px]"
        >
          <p className="text-[10px] uppercase tracking-widest text-floral/40">
            {kpi.label}
          </p>
          <div>
            <p className="font-mono text-2xl font-light text-floral">
              {kpi.value}
            </p>
            {kpi.delta ? (
              <p className="mt-1 text-xs text-floral/40">
                {kpi.delta}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
