const MOCK_FORECAST = [40, 44, 48, 42, 54, 64, 59, 67, 72, 75];

export function ForecastCard() {
  const max = Math.max(...MOCK_FORECAST);

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-floral">Carbon Intensity Forecast</h3>
        <span className="text-xs text-floral/60">Fourier-smoothed</span>
      </div>
      <div className="flex h-24 items-end gap-2">
        {MOCK_FORECAST.map((point, index) => {
          const height = Math.max(10, (point / max) * 100);
          return (
            <div key={`${point}-${index}`} className="relative flex-1 rounded-md bg-floral/5">
              <div
                className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-crusoe/75 to-crusoe/30"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-floral/55">
        Projection indicates a possible threshold crossing in 2.1 days.
      </p>
    </section>
  );
}
