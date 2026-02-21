import { ZONE_HOURLY_PROFILES } from "@/lib/electricity-maps/client";

const IE_PROFILE = ZONE_HOURLY_PROFILES.IE;

export function ForecastCard() {
  const nowHour = new Date().getUTCHours();
  const max = Math.max(...IE_PROFILE);
  const min = Math.min(...IE_PROFILE);

  let optimalHour = 0;
  let optimalVal = Infinity;
  for (let i = 0; i < 24; i++) {
    const h = (nowHour + i) % 24;
    if (IE_PROFILE[h] < optimalVal) {
      optimalVal = IE_PROFILE[h];
      optimalHour = h;
    }
  }
  const hoursUntilOptimal = (optimalHour - nowHour + 24) % 24;
  const currentVal = IE_PROFILE[nowHour];
  const savingsPct = Math.round(
    ((currentVal - optimalVal) / currentVal) * 100
  );

  return (
    <section className="rounded border-[0.5px] border-border-subtle bg-canvas-raised px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-ink-muted">
          Carbon Intensity Forecast
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-ink-faint">
          Ireland · 2025
        </span>
      </div>
      <div className="flex h-20 items-end gap-[3px]">
        {IE_PROFILE.map((point, index) => {
          const height = Math.max(8, ((point - min) / (max - min)) * 100);
          const isCurrent = index === nowHour;
          const isOptimal = index === optimalHour;
          return (
            <div key={index} className="relative flex-1">
              <div
                className={`absolute bottom-0 w-full rounded-sm ${
                  isOptimal
                    ? "bg-stoneware-green"
                    : isCurrent
                      ? "bg-stoneware-turquoise"
                      : "bg-border"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs font-light text-ink-muted">
          {hoursUntilOptimal === 0
            ? `Now is optimal — ${optimalVal} gCO₂/kWh`
            : `Optimal in ~${hoursUntilOptimal}h (${String(optimalHour).padStart(2, "0")}:00 UTC, ${optimalVal} gCO₂/kWh) · save ~${savingsPct}%`}
        </p>
        <p className="font-mono text-[10px] text-ink-faint">
          {String(nowHour).padStart(2, "0")}:00 UTC
        </p>
      </div>
    </section>
  );
}
