type OverageBillingCardProps = {
  includedKg: number;
  usedKg: number;
  unitPrice: number;
};

export function OverageBillingCard({
  includedKg,
  usedKg,
  unitPrice
}: OverageBillingCardProps) {
  const billableKg = Math.max(0, usedKg - includedKg);
  const estimate = billableKg * unitPrice;

  return (
    <section className="rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-8 py-10">
      <h3 className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
        Overage Billing
      </h3>
      <div className="mt-8 space-y-4 text-sm font-light text-[#FFF8F0]">
        <p className="flex items-center justify-between">
          <span className="text-[#FFF8F0]/50">Included budget</span>
          <span className="font-mono">{includedKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-[#FFF8F0]/50">Billable usage</span>
          <span className="font-mono">{billableKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-[#FFF8F0]/50">Price per kgCO2e</span>
          <span className="font-mono">${unitPrice.toFixed(2)}</span>
        </p>
      </div>
      <div className="mt-8 rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] p-5">
        <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
          Estimated Stripe charge
        </p>
        <p className="mt-3 font-mono text-2xl font-light text-[#FFF8F0]">
          ${estimate.toFixed(2)}
        </p>
      </div>
    </section>
  );
}
