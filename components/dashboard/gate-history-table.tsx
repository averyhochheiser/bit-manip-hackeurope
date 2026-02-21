export type GateEvent = {
  id: string;
  prNumber: number;
  repo: string;
  branch: string;
  kgCO2e: number;
  status: "Passed" | "Rerouted to Crusoe";
  emittedAt: string;
};

type GateHistoryTableProps = {
  events: GateEvent[];
};

export function GateHistoryTable({ events }: GateHistoryTableProps) {
  return (
    <div className="relative flex h-full flex-col bg-canvas-raised p-6 lg:p-10">
      <div className="mb-12 flex items-center justify-between">
        <h3 className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-10 lg:top-10">
          Gate Check History
        </h3>
        <span className="absolute right-6 top-6 lg:right-10 lg:top-10 border-[0.5px] border-border-subtle bg-canvas px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink-faint">
          Last {events.length} checks
        </span>
      </div>
      <div className="mt-6 flex-1 overflow-hidden border-[0.5px] border-border-subtle">
        <table className="w-full text-left text-sm font-light">
          <thead className="bg-canvas text-[10px] uppercase tracking-widest text-ink-muted">
            <tr>
              <th className="px-5 py-4 font-normal">PR</th>
              <th className="px-5 py-4 font-normal">Repo</th>
              <th className="px-5 py-4 font-normal">kgCO2e</th>
              <th className="px-5 py-4 font-normal">Status</th>
              <th className="px-5 py-4 font-normal">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-t border-border-subtle text-ink"
              >
                <td className="px-5 py-4 font-mono">#{event.prNumber}</td>
                <td className="px-5 py-4">
                  <p>{event.repo}</p>
                  <p className="text-xs text-ink-muted">{event.branch}</p>
                </td>
                <td className="px-5 py-4 font-mono">
                  {event.kgCO2e.toFixed(2)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest ${event.status === "Passed"
                        ? "border-[0.5px] border-stoneware-green/30 bg-stoneware-green/5 text-stoneware-green"
                        : "border-[0.5px] border-stoneware-turquoise/30 bg-stoneware-turquoise/10 text-stoneware-turquoise"
                      }`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-ink-muted">{event.emittedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
