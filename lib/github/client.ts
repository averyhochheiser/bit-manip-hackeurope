/**
 * GitHub REST API client — fetches real repo data for the logged-in user.
 *
 * Uses the GitHub OAuth token stored in the `gh_token` cookie (captured
 * during /auth/callback).  Falls back to unauthenticated public access
 * using the username when no token is available (60 req/hr rate limit).
 */

import { cookies } from "next/headers";

const GITHUB_API = "https://api.github.com";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  fullName: string;        // "owner/repo"
  name: string;            // "repo"
  owner: string;           // "owner"
  description: string | null;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
  isPrivate: boolean;
  htmlUrl: string;
  /** "owned" | "contributed" */
  relation: "owned" | "contributed";
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function getGitHubToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("gh_token")?.value ?? null;
  } catch {
    return null;
  }
}

function headers(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch<T>(path: string, token: string | null): Promise<T | null> {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: headers(token),
      next: { revalidate: 120 }, // cache for 2 min
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Raw GitHub API response shapes ──────────────────────────────────────────

interface GHRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  html_url: string;
  fork: boolean;
}

interface GHEvent {
  type: string;
  repo: { name: string };
  created_at: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch repos the user owns (or is a member of).
 * With a token this includes private repos; without, only public.
 */
export async function getUserOwnedRepos(username: string): Promise<GitHubRepo[]> {
  const token = await getGitHubToken();

  // When authenticated, /user/repos gives private + public repos the token can see
  const path = token
    ? `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`
    : `/users/${username}/repos?per_page=100&sort=updated`;

  const raw = await ghFetch<GHRepo[]>(path, token);
  if (!raw) return [];

  return raw
    .filter((r) => !r.fork)
    .map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      description: r.description,
      language: r.language,
      stargazersCount: r.stargazers_count,
      updatedAt: r.updated_at,
      isPrivate: r.private,
      htmlUrl: r.html_url,
      relation: "owned" as const,
    }));
}

/**
 * Fetch repos the user has recently contributed to (via public events API).
 * Returns repos where the user pushed, opened PRs, or reviewed code.
 */
export async function getUserContributedRepos(username: string): Promise<GitHubRepo[]> {
  const token = await getGitHubToken();

  // GitHub Events API returns the last 90 days / 300 events
  const events = await ghFetch<GHEvent[]>(
    `/users/${username}/events?per_page=100`,
    token
  );
  if (!events) return [];

  // Unique repos from contribution events
  const contributionTypes = new Set([
    "PushEvent",
    "PullRequestEvent",
    "PullRequestReviewEvent",
    "IssuesEvent",
    "CreateEvent",
  ]);

  const repoNames = new Set<string>();
  for (const ev of events) {
    if (contributionTypes.has(ev.type)) {
      repoNames.add(ev.repo.name);
    }
  }

  // Fetch details for each unique contributed repo
  const repos: GitHubRepo[] = [];
  const fetchPromises = Array.from(repoNames).slice(0, 30).map(async (fullName) => {
    const repo = await ghFetch<GHRepo>(`/repos/${fullName}`, token);
    if (repo) {
      repos.push({
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        updatedAt: repo.updated_at,
        isPrivate: repo.private,
        htmlUrl: repo.html_url,
        relation: "contributed" as const,
      });
    }
  });
  await Promise.all(fetchPromises);

  return repos;
}

/**
 * Get ALL repos for a user — owned + contributed, deduplicated.
 * Owned repos take precedence in the dedup (they get the "owned" relation).
 */
export async function getAllUserRepos(username: string): Promise<GitHubRepo[]> {
  if (!username) return [];

  const [owned, contributed] = await Promise.all([
    getUserOwnedRepos(username),
    getUserContributedRepos(username),
  ]);

  // Dedup: owned takes precedence
  const seen = new Set<string>();
  const result: GitHubRepo[] = [];

  for (const repo of owned) {
    seen.add(repo.fullName);
    result.push(repo);
  }
  for (const repo of contributed) {
    if (!seen.has(repo.fullName)) {
      seen.add(repo.fullName);
      result.push(repo);
    }
  }

  // Sort: most recently updated first
  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return result;
}
