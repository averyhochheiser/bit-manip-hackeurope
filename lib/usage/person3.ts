export type Person3UsageEvent = {
  orgId: string;
  repo: string;
  branch: string;
  prNumber: number;
  commitSha: string;
  kgCO2e: number;
  status: "Passed" | "Rerouted to Crusoe";
  emittedAt: string;
};

export async function fetchPerson3UsageEvents(sinceCursor?: string) {
  const baseUrl = process.env.PERSON3_API_BASE_URL;
  const apiKey = process.env.PERSON3_API_KEY;

  if (!baseUrl) {
    return [];
  }

  const url = new URL("/usage/events", baseUrl);
  if (sinceCursor) {
    url.searchParams.set("since", sinceCursor);
  }

  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Person 3 API returned ${response.status}`);
  }

  const payload = (await response.json()) as { events: Person3UsageEvent[] };
  return payload.events || [];
}
