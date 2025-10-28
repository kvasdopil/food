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
   - *(optional)* `RECIPE_STORAGE_BUCKET`: overrides the default `recipe-images` bucket name

2. Install dependencies and run the dev server:

   ```bash
   yarn install
   yarn dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The home page queries the `recipes` table provisioned via Supabase migrations. Run:

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

- Home route `/` server-redirects to a random recipe slug (`/recipes/[slug]`).
- Dynamic route `src/app/recipes/[slug]/page.tsx` renders the full recipe view (image, tags, ingredients, instructions).
- Supabase provides recipe data via RPC (`get_random_recipe`) and table queries; types generated in `src/types/supabase.ts`.
- Client helpers:
  - `KeyboardNav` handles arrow-key navigation with random fallback when history is empty.
  - `RecipeSideNav` renders prev/next buttons using `/api/random-recipe`.
- API route `/api/random-recipe` returns a random slug, optionally excluding the current recipe.

## Page Structure

- `src/app/page.tsx`: server component redirecting to a random slug.
- `src/app/recipes/[slug]/page.tsx`: server component building the recipe layout and metadata.
- `src/components/*`: client-side interactivity (share, favorite, nav, keyboard shortcuts).
- `src/app/api/random-recipe/route.ts`: edge handler selecting a random recipe slug.

## Recipe Asset Workflow

- Generate structured recipes + hero prompts and images via:

  ```bash
  yarn ts-node scripts/recipe-generator.ts "Meal Name" --description "..." --tags "tag1,tag2"
  ```

- Upload generated JPGs to Supabase Storage:

  ```bash
  yarn ts-node scripts/upload-recipes-to-storage.ts
  ```

- Rebuild the SQL seed and upsert directly to the remote DB:

  ```bash
  yarn ts-node scripts/build-recipe-seed.ts
  yarn ts-node scripts/seed-recipes.ts
  ```

- Recipe metadata lives in `data/recipes/<slug>/` (YAML + manifest). Storage uploads land in the `recipe-images` bucket by default.

## Data Flow

1. `/` → `getRandomSlug()` (Supabase RPC) → redirect to `/recipes/[slug]`.
2. `/recipes/[slug]` → `fetchRecipeBySlug` (Supabase query) → render sections.
3. Client navigation → `/api/random-recipe` (exclude current slug) → `router.push('/recipes/[slug]')` or `router.back()`.
4. Supabase trigger `generate_recipe_slug` ensures unique slugs and suffixes.

## Supabase Configuration

- Schema is defined in `supabase/migrations/*create_recipes_table.sql` and includes:
  - `slug`, `name`, `description`, `ingredients`, `instructions`, `image_url`, `tags`, timestamps
  - Slugs auto-generate from recipe names (duplicates receive `-2`, `-3`, … suffixes) and the homepage immediately redirects to `/recipes/[slug]`.
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
