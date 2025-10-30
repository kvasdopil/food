## Stack

- [Next.js](https://nextjs.org) App Router + React Server Components
- [Tailwind CSS](https://tailwindcss.com) styling
- [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- Ready for [Vercel](https://vercel.com) deployment

## Local Setup

1. Copy the example environment file and set your Supabase credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL from the Supabase dashboard
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon public key from Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: service role token (used by the CLI scripts for storage + seeding)
   - `EDIT_TOKEN`: shared bearer token required for protected API endpoints (e.g. recipe imports)
   - _(optional)_ `RECIPE_STORAGE_BUCKET`: overrides the default `recipe-images` bucket name

2. Install dependencies and run the dev server:

   ```bash
   yarn install
   yarn dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The app uses the `recipes` table provisioned via Supabase migrations. Run:

```bash
supabase db push          # apply migrations to the linked project
supabase db reset --yes   # optional: reset + seed (only on empty databases)
```

## Deploy to Vercel

1. Install the Vercel CLI if you have not already:

   ```bash
   npm i -g vercel
   ```

2. Authenticate and set the default scope:

   ```bash
   vercel login
   vercel link
   ```

3. Push the project to a Git provider (GitHub/GitLab/Bitbucket) or deploy directly from the CLI:

   ```bash
   vercel --prod
   ```

4. In the Vercel dashboard, add the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   environment variables under **Settings → Environment Variables**, then redeploy.

## Project Status

- Home route `/` server-redirects to a random recipe slug (`/recipes/[slug]`) for optimal sharing.
- Feed route `/feed` displays a scrollable grid/list of recipes with pagination (20 per page), infinite scroll, and favorite functionality. Desktop shows up to 4 columns in a grid with gaps and shadows; mobile shows single-column full-width cards.
- Dynamic route `src/app/recipes/[slug]/page.tsx` handles metadata generation only; rendering is handled by the layout.
- Layout `src/app/recipes/layout.tsx` manages the persistent carousel wrapper to prevent remounting during navigation, and includes a back-to-feed button in the top-left corner.
- Navigation history checks use `document.referrer` to ensure same-origin navigation (prevents "about:blank" issues). Previous navigation is disabled/hidden when there's no same-origin history.
- Supabase provides recipe data via table queries; types generated in `src/types/supabase.ts`.
- Authenticated POST to `/api/recipes` upserts recipes from JSON payloads that match the YAML schema. Requires a `Bearer` token that matches `EDIT_TOKEN`.
- Client helpers:
  - `KeyboardNav` handles arrow-key navigation with random fallback when there's no same-origin history.
  - `RecipeSideNav` renders prev/next buttons using `/api/recipes?from={slug}` for slug-based pagination (matches feed order). Previous button is hidden when there's no same-origin history.
  - `RecipeSwipeableCarousel` provides mobile swipe gestures with preloaded next recipes. Previous swipe is disabled when there's no same-origin history. Swipes require the card to visually cross 50% of screen width before navigation (not just finger movement).
  - `RecipeFeedCard` displays recipe cards with images, titles, descriptions, tags, and like status (persisted in localStorage).

## Roadmap & Planned Features

- **Navigation Improvements**:
  - "Next" button should navigate to next recipe in feed order (not random)
  - Back swipe should navigate back in browser history
  - Feed should be a card within a swiper to preserve position when swiped back to

- **Feed Enhancements**:
  - Make feed truly infinite (currently paginated)
  - Add tag filtering functionality
  - Add dedicated page to list all liked/favorited meals

- **Recipe Management**:
  - Add new recipes via agent/API integration (with secure Vercel token authentication)
  - Support recipe variations (e.g., vegetarian versions of existing meals)

- **Performance & UX**:
  - Implement SSR for better performance and SEO
  - Add proper loading preview/skeleton for recipe pages

- **Future Schema Extensions**:
  - Prep time and cooking time fields
  - Servings/nutrition information
  - User authentication and recipe contributions

## Page Structure

- `src/app/page.tsx`: server component redirecting to `/feed`.
- `src/app/feed/page.tsx`: client component displaying paginated recipe feed with infinite scroll.
- `src/app/recipes/layout.tsx`: client layout component that manages the persistent carousel, navigation, recipe rendering, and back-to-feed button. Prevents carousel remounting during route changes.
- `src/app/recipes/[slug]/page.tsx`: server component that only handles metadata generation (OpenGraph, title, etc.). Returns `null` as layout handles all rendering.
- `src/app/recipes/[slug]/client/recipe-swipeable-carousel.tsx`: carousel component managing swipe navigation with preloaded recipes. Maintains state across navigation using module-level snapshot.
- `src/components/*`: client-side interactivity (share, favorite, nav, keyboard shortcuts).
- `src/components/recipe-feed-card.tsx`: recipe card component for feed page with image, title overlay, description, tags, and favorite button.
- `src/app/api/recipes/route.ts`: API endpoint returning paginated recipes (20 per page) with pagination metadata. Supports `page` parameter for traditional pagination or `from={slug}` for slug-based pagination that matches feed order.

## Recipe Asset Workflow

- Generate structured recipes + hero prompts and images via:

  ```bash
  yarn ts-node scripts/recipe-generator.ts "Meal Name" --description "..." --tags "tag1,tag2"
  ```

- Upload generated JPGs to Supabase Storage:

  ```bash
  yarn ts-node scripts/upload-recipes-to-storage.ts
  ```

- Rebuild the SQL seed and upsert directly to the remote DB (ingredients are stored as JSON arrays in Supabase):

  ```bash
  yarn ts-node scripts/build-recipe-seed.ts
  yarn ts-node scripts/seed-recipes.ts
  ```

- Upload an existing YAML recipe to a running API (defaults to `http://localhost:3000/api/recipes`):

  ```bash
  yarn ts-node scripts/upload-recipe.ts data/recipes/creamy-mushroom-risotto/creamy-mushroom-risotto.yaml --token "$EDIT_TOKEN"
  ```

- Recipe metadata lives in `data/recipes/<slug>/` (YAML + manifest). Storage uploads land in the `recipe-images` bucket by default. Ingredient entries should use `{ name, amount, notes }` with metric abbreviations (`g`, `ml`, `tsp`, etc.).

### Recipe Upload CLI & API

- `scripts/upload-recipe.ts` posts YAML recipe files to the recipe API, resolving image URLs from the local manifest or Supabase storage when possible.
- The command reads `EDIT_TOKEN` from `--token`, the environment, or `.env.local`, and falls back to `http://localhost:3000/api/recipes` unless `--endpoint` or `RECIPE_API_URL` is provided.
- `POST /api/recipes` accepts normalized recipe payloads, upserting by slug. Requests must include `Authorization: Bearer <EDIT_TOKEN>`; the server rejects missing or mismatched tokens with `401`.
- Typical workflow: generate or edit a recipe YAML locally, verify assets are uploaded, then run the CLI to seed a local or remote deployment (e.g., `https://your-app.vercel.app/api/recipes`) with the corresponding bearer token.

## Data Flow

1. `/` → redirect to random recipe slug (`/recipes/[slug]`) for optimal sharing.
2. `/feed` → fetches paginated recipes from `/api/recipes` → displays in responsive grid/list with infinite scroll.
3. `/recipes/[slug]` → layout extracts slug from pathname → `fetchRecipeBySlug` (Supabase query) → render via layout wrapper.
4. Layout `src/app/recipes/layout.tsx` persists across route changes, preventing carousel remounting during navigation. Includes back-to-feed button in top-left corner.
5. Client navigation → `/api/recipes?from={slug}` (slug-based pagination matching feed order) → `router.replace('/recipes/[slug]')` → layout updates slug and re-renders.
6. Previous navigation only works when `document.referrer` indicates same-origin navigation (prevents "about:blank" issues).
7. Supabase trigger `generate_recipe_slug` ensures unique slugs and suffixes.
8. Favorites are stored in browser localStorage (key: `recipe-favorites`) and persist across page reloads.

## Supabase Configuration

- Schema is defined in `supabase/migrations/*create_recipes_table.sql` and includes:
  - `slug`, `name`, `description`, `ingredients`, `instructions`, `image_url`, `tags`, timestamps
  - Slugs auto-generate from recipe names (duplicates receive `-2`, `-3`, … suffixes)
  - Row Level Security with read-only anonymous policy
- Example content is seeded from `supabase/seed.sql` during `supabase db reset`.
- Regenerate TypeScript types whenever the schema changes:

  ```bash
  supabase gen types typescript --project-id <project-ref> --schema public > src/types/supabase.ts
  ```

- Extend the schema (prep time, servings, user auth) in new migrations as requirements grow.

## Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
