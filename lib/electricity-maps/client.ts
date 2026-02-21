/**
 * Carbon intensity lookup for cloud regions.
 *
 * Primary source: Electricity Maps API (auth-token header, v3 endpoint).
 * Fallback:       Static regional averages from Electricity Maps 2024 data.
 *
 * Set ELECTRICITY_MAPS_API_KEY in .env.local for live data.
 * Without the key the static fallback is used automatically.
 */

// Static average carbon intensities (gCO₂eq/kWh) — Electricity Maps 2024 data
const STATIC_INTENSITY: Record<string, number> = {
  "us-east-1":      386, // N. Virginia  — PJM grid, gas-heavy
  "us-east-2":      488, // Ohio         — MISO, coal-heavy
  "us-west-1":      246, // N. California— CISO, gas + solar
  "us-west-2":      136, // Oregon       — BPAT, hydro-heavy
  "ca-central-1":    30, // Canada       — hydro-dominant
  "eu-west-1":      291, // Ireland      — gas + wind
  "eu-west-2":      228, // London       — mixed, improving
  "eu-west-3":       60, // Paris        — nuclear-heavy
  "eu-central-1":   337, // Frankfurt    — coal + gas
  "eu-north-1":      26, // Stockholm    — hydro + nuclear
  "eu-south-1":     270, // Milan        — mixed
  "ap-southeast-1": 507, // Singapore    — gas-heavy
  "ap-northeast-1": 480, // Tokyo        — gas + nuclear
  "ap-northeast-2": 415, // Seoul        — coal-heavy
  "ap-south-1":     704, // Mumbai       — coal-heavy
  "ap-southeast-2": 610, // Sydney       — coal + gas
  "sa-east-1":       74, // São Paulo    — hydro-dominant
  "me-south-1":     627, // Bahrain      — gas-heavy
  "af-south-1":     728, // Cape Town    — coal-heavy
};

// Map cloud region slug → Electricity Maps zone code
const REGION_TO_ZONE: Record<string, string> = {
  "us-east-1":   "US-MIDA-PJM",
  "us-east-2":   "US-MIDW-MISO",
  "us-west-1":   "US-CAL-CISO",
  "us-west-2":   "US-NW-BPAT",
  "eu-west-1":   "IE",
  "eu-west-2":   "GB",
  "eu-west-3":   "FR",
  "eu-central-1":"DE",
  "eu-north-1":  "SE",
  "ap-northeast-1": "JP-TK",
  "ap-south-1":  "IN-NO",
  "sa-east-1":   "BR-CS",
};

/**
 * Returns live or cached carbon intensity (gCO₂eq/kWh) for a cloud region.
 * Falls back to static averages if the Electricity Maps key is not set or the
 * call fails.
 */
export async function getCarbonIntensity(region: string): Promise<number> {
  const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;
  const zone = REGION_TO_ZONE[region];

  if (apiKey && zone) {
    try {
      const res = await fetch(
        `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${zone}`,
        {
          headers: { "auth-token": apiKey },
          next: { revalidate: 300 }, // cache 5 min
        }
      );

      if (res.ok) {
        const body = await res.json() as { carbonIntensity?: number };
        if (typeof body.carbonIntensity === "number") {
          return body.carbonIntensity;
        }
      }
    } catch (err) {
      console.warn("[electricity-maps] live fetch failed, using static fallback:", err);
    }
  }

  return STATIC_INTENSITY[region] ?? 400;
}

/** Returns all static intensities (useful for forecast / optimal-window logic). */
export function getStaticIntensities() {
  return STATIC_INTENSITY;
}
