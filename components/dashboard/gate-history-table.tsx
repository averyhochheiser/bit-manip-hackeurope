"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-floral">Gate Check History</h3>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-widest text-floral/40">
          Last {events.length} checks
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.2em] text-floral/30">
            <tr>
              <th className="pb-4 pr-4 pl-0 font-medium">PR</th>
              <th className="pb-4 px-4 font-medium">Repository / Branch</th>
              <th className="pb-4 px-4 font-medium">Footprint</th>
              <th className="pb-4 pl-4 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {events.map((event, i) => (
              <motion.tr
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group transition-colors hover:bg-white/[0.02]"
              >
                <td className="py-4 pr-4 font-monoData text-floral/90">
                  <span className="text-floral/30">#</span>{event.prNumber}
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-floral/90">{event.repo}</span>
                    <span className="text-[11px] font-monoData text-floral/30">{event.branch}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-monoData text-base font-medium text-floral">
                      {event.kgCO2e.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-floral/30 uppercase tracking-tighter">kgCO₂e</span>
                  </div>
                </td>
                <td className="py-4 pl-4 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      event.status === "Passed"
                        ? "border border-sage/20 bg-sage/10 text-sage"
                        : "border border-crusoe/20 bg-crusoe/10 text-crusoe"
                    )}
                  >
                    <span className={cn("h-1 w-1 rounded-full", event.status === "Passed" ? "bg-sage" : "bg-crusoe")} />
                    {event.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
