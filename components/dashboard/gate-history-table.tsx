"use client";

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
    <div className="panel flex h-full flex-col p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-floral/40">
          Gate Check History
        </h3>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-widest text-floral/30">
          Last {events.length} checks
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm font-light">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-widest text-floral/40">
            <tr>
              <th className="px-5 py-3 font-normal">PR</th>
              <th className="px-5 py-3 font-normal">Repo</th>
              <th className="px-5 py-3 font-normal">kgCO2e</th>
              <th className="px-5 py-3 font-normal">Status</th>
              <th className="px-5 py-3 font-normal">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-t border-white/[0.05] text-floral"
              >
                <td className="px-5 py-3 font-mono">#{event.prNumber}</td>
                <td className="px-5 py-3">
                  <p>{event.repo}</p>
                  <p className="text-xs text-floral/40">{event.branch}</p>
                </td>
                <td className="px-5 py-3 font-mono">
                  {event.kgCO2e.toFixed(2)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest ${
                      event.status === "Passed"
                        ? "border border-sage/30 bg-sage/10 text-sage"
                        : "border border-crusoe/30 bg-crusoe/10 text-crusoe"
                    }`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-floral/40">{event.emittedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
