# Recipe Thing Requirements

## Product Scope

- Mobile-first responsive web app optimised for small screens, with graceful scaling to larger viewports.
- Landing route `/` immediately redirects to a random recipe slug so shared URLs are always `/recipes/[slug]`.
- Each recipe has:
  - `name`
  - `description`
  - `ingredients` (text block, newline-separated list accepted)
  - `instructions` (text block)
  - `image_url`
  - `tags` (array for grouping/filtering)
- Dedicated, shareable recipe page at `/recipes/[slug-or-id]` with unique URL.
- Sharing support via `navigator.share` when available, plus copy-link fallback.
- UI includes actions to refresh and fetch another random recipe.

## Data & Infrastructure

- Database managed via Supabase SQL migrations (`supabase/migrations`) and seeds (`supabase/seed.sql`).
- Recipes table created through migrations; Row Level Security policies defined alongside schema changes.
- Supabase TypeScript types generated and committed for typed data access.
- Vercel hosts the production deployment with Supabase env vars configured (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Open Decisions / Next Steps

- Decide on slug format (human-readable slug vs UUID) before implementing `/recipes/[slug]`.
- Define OG metadata requirements (title/description/image) for share previews.
- Consider future fields (prep time, servings, ingredients normalization) and roadmap for multi-user contributions.
