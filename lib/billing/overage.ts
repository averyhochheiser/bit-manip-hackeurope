export type OverageBreakdown = {
  periodUsageKg: number;
  includedKg: number;
  billableKg: number;
  estimatedCharge: number;
};

export function calculateOverage(
  periodUsageKg: number,
  includedKg: number,
  unitPrice: number
): OverageBreakdown {
  const safeUsage = Math.max(0, periodUsageKg);
  const safeIncluded = Math.max(0, includedKg);
  const billableKg = Math.max(0, safeUsage - safeIncluded);
  const estimatedCharge = billableKg * Math.max(0, unitPrice);

  return {
    periodUsageKg: safeUsage,
    includedKg: safeIncluded,
    billableKg,
    estimatedCharge
  };
}
