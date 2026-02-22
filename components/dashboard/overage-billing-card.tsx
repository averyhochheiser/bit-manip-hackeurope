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
    <section className="panel flex h-full flex-col p-6 lg:p-8">
      <h3 className="text-[10px] uppercase tracking-widest text-floral/40">
        Overage Billing
      </h3>
      <div className="mt-6 space-y-3 text-sm font-light text-floral">
        <p className="flex items-center justify-between">
          <span className="text-floral/50">Included budget</span>
          <span className="font-mono">{includedKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-floral/50">Billable usage</span>
          <span className="font-mono">{billableKg.toFixed(2)}kg</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-floral/50">Price per kgCO2e</span>
          <span className="font-mono">${unitPrice.toFixed(2)}</span>
        </p>
      </div>
      <div className="mt-6 panel-muted p-5">
        <p className="text-[10px] uppercase tracking-widest text-floral/40">
          Estimated Stripe charge
        </p>
        <p className="mt-2 font-mono text-2xl font-light text-floral">
          ${estimate.toFixed(2)}
        </p>
      </div>
    </section>
  );
}
