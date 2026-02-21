# Carbon Gate Demo Script

## 1) Local setup
- `cp .env.example .env.local`
- Fill Supabase + Stripe keys (or keep empty for mock dashboard mode).
- `npm install`
- `npm run dev`

## 2) Demo flow (happy path)
1. Open `/` (marketing page): explain CI/CD carbon gate + EU CBAM headline framing.
2. Open `/dashboard`: show budget utilization hero card, forecast sparkline, and gate history.
3. Open `/settings`: adjust budget threshold, start Stripe subscription, open customer portal.
4. Trigger ingestion via `POST /api/usage/ingest` (with `x-cron-secret`) to sync Person 3 usage.
5. Explain Stripe metered overage estimate updates in dashboard cards.

## 3) Fallback if APIs are unavailable
- Dashboard automatically falls back to mock read model values from `lib/dashboard/mock-data.ts`.
- You can still showcase:
  - green -> warning -> crusoe state transitions in progress bar
  - bento dashboard density and policy controls
  - planned webhook and ingestion architecture
