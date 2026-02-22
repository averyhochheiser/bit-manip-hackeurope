import { ZONE_HOURLY_PROFILES } from "@/lib/electricity-maps/client";

// Ireland (IE / eu-west-1) real hourly profile from 2025 dataset
// 24 values = gCO₂eq/kWh per UTC hour (index 0 = 00:00 UTC)
const IE_PROFILE = ZONE_HOURLY_PROFILES.IE;

export function ForecastCard() {
  const nowHour = new Date().getUTCHours();
  const max = Math.max(...IE_PROFILE);
  const min = Math.min(...IE_PROFILE);

  // Find the optimal (min) hour in the next 24h
  let optimalHour = 0;
  let optimalVal = Infinity;
  for (let i = 0; i < 24; i++) {
    const h = (nowHour + i) % 24;
    if (IE_PROFILE[h] < optimalVal) { optimalVal = IE_PROFILE[h]; optimalHour = h; }
  }
  const hoursUntilOptimal = (optimalHour - nowHour + 24) % 24;
  const currentVal = IE_PROFILE[nowHour];
  const savingsPct = Math.round(((currentVal - optimalVal) / currentVal) * 100);

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Carbon Intensity Forecast</h3>
        <span className="text-xs text-white/60">Ireland · 2025 dataset</span>
      </div>
      <div className="flex h-24 items-end gap-[2px]">
        {IE_PROFILE.map((point, index) => {
          const height = Math.max(8, ((point - min) / (max - min)) * 100);
          const isCurrent = index === nowHour;
          const isOptimal = index === optimalHour;
          return (
            <div key={index} className="relative flex-1 rounded-sm bg-white/5">
              <div
                className={`absolute bottom-0 w-full rounded-sm bg-gradient-to-t ${
                  isOptimal
                    ? "from-emerald-400 to-emerald-200"
                    : isCurrent
                    ? "from-sky-400 to-sky-200"
                    : "from-crusoe/75 to-emerald-300/75"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-white/55">
          {hoursUntilOptimal === 0
            ? `Now is the optimal window — ${optimalVal} gCO₂/kWh`
            : `Optimal in ~${hoursUntilOptimal}h (${String(optimalHour).padStart(2,"0")}:00 UTC, ${optimalVal} gCO₂/kWh) · save ~${savingsPct}%`}
        </p>
        <p className="text-xs text-white/35">now {String(nowHour).padStart(2,"0")}:00 UTC</p>
      </div>
    </section>
  );
}
