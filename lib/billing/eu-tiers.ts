/**
 * EU-Compliant Carbon Billing Tiers
 *
 * Thresholds and pricing aligned with:
 *
 * 1. EU ETS (Emissions Trading System) — Phase IV (2021-2030)
 *    Carbon price benchmark: ~€80–100/tCO₂ (≈ €0.08–0.10/kgCO₂)
 *    Source: EU ETS Directive 2003/87/EC, amended 2023
 *
 * 2. EU CSRD (Corporate Sustainability Reporting Directive)
 *    Requires Scope 1/2/3 disclosure for companies >250 employees
 *    or listed SMEs. Our Gate reports are CSRD-compatible metrics.
 *
 * 3. EU CBAM (Carbon Border Adjustment Mechanism) — effective Oct 2023
 *    Transitional period: reporting only (no financial adjustment yet)
 *    Full financial adjustment: 2026+
 *
 * 4. EU Taxonomy Regulation — "Do No Significant Harm" principle
 *    Activities must not exceed sector-specific thresholds.
 *    ICT sector benchmark: 100 gCO₂e/kWh for data centres (JRC 2024)
 *
 * 5. Science Based Targets initiative (SBTi) — 1.5°C pathway
 *    ICT sector: −4.2% annual reduction (absolute contraction)
 *
 * Tier design:
 *   - Free tier:  Reporting-only (CSRD compliance), hard cap at EU Taxonomy
 *                 "Do No Significant Harm" threshold for SME data centres.
 *   - Pro tier:   Higher budget + metered overage priced at EU ETS benchmark.
 *   - Enterprise: Custom budget, SBTi-aligned annual reduction targets.
 */

// ── Regulatory Constants ─────────────────────────────────────────────────────

/** EU ETS Phase IV average carbon price (€/tonne CO₂), Feb 2026 */
export const EU_ETS_PRICE_EUR_PER_TONNE = 85;

/** Converted to per-kg and USD (approximate 1 EUR = 1.08 USD, Feb 2026) */
export const EU_ETS_PRICE_USD_PER_KG = (EU_ETS_PRICE_EUR_PER_TONNE / 1000) * 1.08; // ≈ $0.092

/** EU Taxonomy "Do No Significant Harm" threshold for ICT (gCO₂e/kWh) */
export const EU_TAXONOMY_DNSH_ICT_G_PER_KWH = 100;

/** CBAM transitional surcharge multiplier (1.0 = no surcharge in transition) */
export const CBAM_SURCHARGE_MULTIPLIER = 1.0; // becomes >1 post-2026

/** SBTi 1.5°C absolute contraction rate for ICT (annual %) */
export const SBTI_ANNUAL_REDUCTION_PCT = 4.2;

// ── Billing Tiers ────────────────────────────────────────────────────────────

export interface BillingTier {
  id: string;
  name: string;
  /** Monthly included carbon budget in kgCO₂e */
  includedKg: number;
  /** Hard cap — gate blocks PRs beyond this (0 = no hard cap) */
  hardCapKg: number;
  /** Monthly base price in USD cents */
  basePriceCents: number;
  /** Overage rate per kgCO₂e in USD cents (EU ETS-aligned) */
  overagePerKgCents: number;
  /** Warning threshold as % of included budget */
  warningPct: number;
  /** Gate status when budget is exceeded: "warn" allows merge, "block" does not */
  overBudgetAction: "warn" | "block";
  /** CSRD-formatted reporting included */
  csrdReporting: boolean;
  /** SBTi annual reduction commitment applied */
  sbtiReduction: boolean;
  /** Stripe Price ID env var name for checkout */
  stripePriceEnvVar: string;
  /** EU regulatory notes shown in dashboard */
  regulatoryNote: string;
}

/**
 * Tier definitions — thresholds based on EU regulatory benchmarks.
 *
 * Free (50 kgCO₂e/mo):
 *   Based on EU Taxonomy DNSH threshold for a small dev team:
 *   100 gCO₂e/kWh × ~500 kWh/mo GPU compute ≈ 50 kg.
 *   This keeps small teams within "do no significant harm" bounds.
 *
 * Pro (200 kgCO₂e/mo):
 *   Scaled for mid-size teams. Overage billed at EU ETS rate so
 *   internal carbon cost mirrors the real market price of emissions.
 *
 * Enterprise (1000 kgCO₂e/mo):
 *   Includes SBTi-aligned annual reduction targets and CSRD-ready reports.
 *   Custom thresholds available via sales.
 */
export const BILLING_TIERS: Record<string, BillingTier> = {
  free: {
    id: "free",
    name: "Starter",
    includedKg: 50,
    hardCapKg: 75,
    basePriceCents: 0,
    overagePerKgCents: 0,
    warningPct: 80,
    overBudgetAction: "block",
    csrdReporting: false,
    sbtiReduction: false,
    stripePriceEnvVar: "",
    regulatoryNote:
      "50 kgCO₂e/mo — aligned with EU Taxonomy DNSH threshold for small-scale ICT workloads.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    includedKg: 200,
    hardCapKg: 0, // no hard cap, metered overage
    basePriceCents: 2900, // $29/mo
    overagePerKgCents: Math.round(EU_ETS_PRICE_USD_PER_KG * 100), // ≈ 9¢/kg
    warningPct: 70,
    overBudgetAction: "warn",
    csrdReporting: true,
    sbtiReduction: false,
    stripePriceEnvVar: "STRIPE_BASE_PRICE_ID",
    regulatoryNote:
      "200 kgCO₂e included. Overage at EU ETS market rate (~€0.085/kg). CSRD-ready reporting.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    includedKg: 1000,
    hardCapKg: 0,
    basePriceCents: 14900, // $149/mo
    overagePerKgCents: Math.round(EU_ETS_PRICE_USD_PER_KG * 100 * 0.85), // 15% volume discount
    warningPct: 60,
    overBudgetAction: "warn",
    csrdReporting: true,
    sbtiReduction: true,
    stripePriceEnvVar: "STRIPE_ENTERPRISE_PRICE_ID",
    regulatoryNote:
      "1,000 kgCO₂e included. EU ETS rate with 15% volume discount. SBTi 1.5°C pathway enforced (−4.2%/yr).",
  },
};

export const DEFAULT_TIER_ID = "free";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Look up tier by id, falling back to free */
export function getTier(tierId: string | null | undefined): BillingTier {
  return BILLING_TIERS[tierId ?? DEFAULT_TIER_ID] ?? BILLING_TIERS.free;
}

/** Compute the SBTi-adjusted annual budget given a base and the year offset */
export function sbtiAdjustedBudget(baseKg: number, yearsFromBaseline: number): number {
  const factor = Math.pow(1 - SBTI_ANNUAL_REDUCTION_PCT / 100, yearsFromBaseline);
  return Math.round(baseKg * factor * 10) / 10;
}

/** Calculate overage charges for a given tier and usage */
export function calculateOverage(tier: BillingTier, usedKg: number) {
  const overageKg = Math.max(0, usedKg - tier.includedKg);
  const overageCents = Math.round(overageKg * tier.overagePerKgCents);
  const isHardCapped = tier.hardCapKg > 0 && usedKg >= tier.hardCapKg;

  return {
    overageKg: Math.round(overageKg * 100) / 100,
    overageCents,
    overageFormatted: `$${(overageCents / 100).toFixed(2)}`,
    isHardCapped,
    /** EU ETS equivalent: what this carbon would cost on the open market */
    etsEquivalentCents: Math.round(overageKg * EU_ETS_PRICE_USD_PER_KG * 100),
    /** Percentage of included budget used */
    utilizationPct: tier.includedKg > 0
      ? Math.round((usedKg / tier.includedKg) * 100)
      : 0,
  };
}

/** Format CSRD-style emission summary for regulatory reporting */
export function csrdSummary(usedKg: number, scope: 1 | 2 | 3 = 3) {
  return {
    scope,
    scopeLabel: scope === 1 ? "Direct" : scope === 2 ? "Indirect (energy)" : "Value chain",
    totalKgCO2e: Math.round(usedKg * 100) / 100,
    totalTonnesCO2e: Math.round((usedKg / 1000) * 1000) / 1000,
    reportingStandard: "ESRS E1 — Climate Change",
    methodology: "GHG Protocol Scope 3 Category 11 (Use of Sold Products)",
    regulatoryFramework: "EU CSRD (Directive 2022/2464)",
    period: `${new Date().toISOString().slice(0, 7)}`,
  };
}
