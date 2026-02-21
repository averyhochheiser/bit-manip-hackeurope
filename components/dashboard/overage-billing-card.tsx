type OverageBillingCardProps = {
  includedKg: number;
  usedKg: number;
  unitPrice: number;
};

export function OverageBillingCard({ includedKg, usedKg, unitPrice }: OverageBillingCardProps) {
  const billableKg = Math.max(0, usedKg - includedKg);
  const estimate = billableKg * unitPrice;

  return (
    <section className="panel p-5">
      <h3 className="text-base font-semibold text-white">Overage Billing</h3>
      <div className="mt-4 space-y-2 text-sm text-white/75">
        <p className="flex items-center justify-between">
          <span>Included budget</span>
          <span className="font-monoData">{includedKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span>Billable usage</span>
          <span className="font-monoData">{billableKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span>Price per kgCO2e</span>
          <span className="font-monoData">${unitPrice.toFixed(2)}</span>
        </p>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.16em] text-white/50">Estimated Stripe charge</p>
        <p className="mt-1 font-monoData text-2xl font-semibold text-white">${estimate.toFixed(2)}</p>
      </div>
    </section>
  );
}
