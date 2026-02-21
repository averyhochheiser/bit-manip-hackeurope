import { cn } from "@/lib/utils";

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
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-floral">Gate Check History</h3>
        <span className="rounded-md border border-floral/15 bg-floral/5 px-2 py-1 text-xs text-floral/65">
          Last {events.length} checks
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-floral/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-floral/5 text-xs uppercase tracking-widest text-floral/55">
            <tr>
              <th className="px-4 py-3">PR</th>
              <th className="px-4 py-3">Repo</th>
              <th className="px-4 py-3">kgCO2e</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-floral/10 text-floral/85">
                <td className="px-4 py-3 font-monoData">#{event.prNumber}</td>
                <td className="px-4 py-3">
                  <p>{event.repo}</p>
                  <p className="text-xs text-floral/55">{event.branch}</p>
                </td>
                <td className="px-4 py-3 font-monoData">{event.kgCO2e.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      event.status === "Passed"
                        ? "border border-sage/35 bg-sage/15 text-sage"
                        : "border border-crusoe/40 bg-crusoe/15 text-crusoe"
                    )}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-floral/65">{event.emittedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
