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

- Home route `/` server-redirects to `/feed`.
- Feed route `/feed` displays a scrollable grid/list of recipes with pagination (20 per page), infinite scroll, and favorite functionality. Desktop shows up to 4 columns in a grid with gaps and shadows; mobile shows single-column full-width cards.
- Dynamic route `src/app/recipes/[slug]/page.tsx` handles metadata generation only; rendering is handled by the layout.
- Layout `src/app/recipes/layout.tsx` manages the persistent carousel wrapper to prevent remounting during navigation, and includes a back-to-feed button in the top-left corner.
- Navigation history checks use `document.referrer` to ensure same-origin navigation (prevents "about:blank" issues). Previous navigation is disabled/hidden when there's no same-origin history.
- Supabase provides recipe data via table queries; types generated in `src/types/supabase.ts`.
- Authenticated POST to `/api/recipes` upserts recipes from JSON payloads that match the YAML schema. Requires a `Bearer` token that matches `EDIT_TOKEN`.

## Screen Structure & Navigation

### Route Hierarchy

The app has three main routes:

1. **`/` (Home)** → Server redirects to `/feed`
2. **`/feed`** → Recipe feed page with paginated grid/list
3. **`/recipes/[slug]`** → Individual recipe pages with unique URLs

### Layout Architecture

**Root Layout** (`src/app/layout.tsx`)
- Minimal wrapper providing fonts (Geist Sans/Mono) and global styles
- No navigation UI

**Recipes Layout** (`src/app/recipes/layout.tsx`)
- **Persistent wrapper** that prevents carousel remounting during navigation
- Manages recipe rendering and navigation state
- Contains:
  - Back-to-feed button (top-left corner)
  - Keyboard navigation handler (global)
  - Side navigation buttons (prev/next) for desktop
  - Mobile swipeable carousel wrapper
  - Desktop standard recipe view

**Recipe Page** (`src/app/recipes/[slug]/page.tsx`)
- Server component that only generates metadata (OpenGraph, title, description)
- Returns `null` - all rendering is handled by the layout

### Navigation System

The app supports three navigation modes:

#### 1. Feed → Recipe Navigation
- Users click on `RecipeFeedCard` components in the feed
- Standard Next.js `Link` navigation to `/recipes/[slug]`
- Cards display: image, title overlay, description, tags, and favorite button (localStorage)

#### 2. Recipe → Recipe Navigation (Desktop)

**Side Navigation Buttons** (`RecipeSideNav`)
- **Previous**: Uses browser `router.back()` (only enabled when history exists)
- **Next**: Fetches next recipe using `/api/recipes?from={slug}` (maintains feed order)
- Fallback to random recipe if API call fails
- Buttons hidden when no history available

**Keyboard Navigation** (`KeyboardNav`)
- **Left Arrow**: Navigate to previous recipe via `router.back()` (if history exists)
- **Right Arrow**: Navigate to next recipe (feed order, with random fallback)
- Disabled when user is typing in input fields

#### 3. Recipe → Recipe Navigation (Mobile)

**Swipeable Carousel** (`RecipeSwipeableCarousel`)
- **Swipe left**: Navigate to next recipe (preloaded)
- **Swipe right**: Navigate to previous recipe (if history exists)
- Requires 50% swipe threshold before navigation triggers
- Preloads next recipe slug automatically
- Maintains carousel state across route changes using module-level snapshot
- Previous swipe disabled when no history available

### History Management

Navigation history is managed via **session storage** (`recipe-history.ts`):

- Tracks recipe navigation stack: `{ stack: string[], index: number }`
- Stored in `sessionStorage` (clears when tab closes)
- Syncs with `document.referrer` to detect same-origin navigation
- Prevents "about:blank" referrer issues
- Enables forward/backward navigation through visited recipes

**History Sync Logic:**
- If `document.referrer` indicates navigation from another recipe page → appends to existing history stack
- If no referrer or external referrer → resets to new stack with current slug
- Reuses existing stack entries when revisiting recipes

**Forward History Support:**
- When user navigates backward, forward entries are preserved
- Forward navigation reuses history entries instead of API calls
- History stack is truncated when navigating forward from middle of stack

### Feed Pagination

**API Endpoint** (`/api/recipes`)
- Supports two pagination modes:
  - `?page=N` → Traditional page-based pagination (20 items per page)
  - `?from={slug}` → Slug-based pagination matching feed order
- Returns 20 recipes with pagination metadata (`hasMore`, `total`, etc.)

**Infinite Scroll:**
- Initial load fetches first 20 recipes
- Auto-loads more when scrolling within 1000px of bottom
- Uses last recipe's slug for `?from=` parameter to maintain order

### Component Hierarchy

```
Feed Page (`/feed`)
├── RecipeFeedCard (multiple, clickable links)
│   ├── Image with title overlay
│   ├── Description
│   ├── Tags (colored chips)
│   └── Favorite button (localStorage)

Recipe Layout (`/recipes/[slug]`)
├── Back to Feed button (top-left)
├── KeyboardNav (global keyboard shortcuts)
├── RecipeSideNav (prev/next buttons - desktop only, xl breakpoint)
├── Mobile (< sm): RecipeSwipeableCarousel
│   └── SwipeableCarousel
│       └── Recipe component (preloaded items)
└── Desktop (≥ sm): Recipe component
    ├── RecipeImage
    ├── Description (with tags)
    ├── Ingredients
    └── Instructions
```

### Navigation Flow Examples

**Flow 1: Feed → Recipe → Next Recipe**
1. User clicks card in feed → navigates to `/recipes/beef-tacos`
2. Layout syncs history: `{ stack: ['beef-tacos'], index: 0 }`
3. User clicks "Next" button or swipes left (mobile)
4. Fetches `/api/recipes?from=beef-tacos` → gets next recipe in feed order
5. Navigates to `/recipes/chicken-stir-fry`
6. History updated: `{ stack: ['beef-tacos', 'chicken-stir-fry'], index: 1 }`

**Flow 2: Back Navigation**
1. User on `/recipes/chicken-stir-fry` (index: 1)
2. User clicks "Previous" button or swipes right (mobile)
3. History moves backward: `{ index: 0 }`
4. Browser `router.back()` → navigates to `/recipes/beef-tacos`
5. Layout detects same slug, reuses history entry

**Flow 3: Direct Link from External Source**
1. User shares `/recipes/beef-tacos` URL
2. New visitor opens link (no referrer or external referrer)
3. History resets: `{ stack: ['beef-tacos'], index: 0 }`
4. Previous navigation disabled/hidden (no history to go back to)

This architecture provides stateful navigation that tracks forward and backward movement while gracefully handling external links.

## Roadmap & Planned Features

- **Navigation Improvements**:
  - Feed should be a card within a swiper to preserve position when swiped back to
  - Improve history persistence across page refreshes

- **Feed Enhancements**:
  - Add tag filtering functionality
  - Add dedicated page to list all liked/favorited meals
  - Search functionality

- **Recipe Management**:
  - Add new recipes via agent/API integration (with secure Vercel token authentication)
  - Support recipe variations (e.g., vegetarian versions of existing meals)

- **Performance & UX**:
  - Implement SSR for better performance and SEO
  - Add proper loading preview/skeleton for recipe pages
  - Optimize image loading and preloading

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

1. **Home Route** (`/`) → Server redirects to `/feed`
2. **Feed Route** (`/feed`) → Client component fetches paginated recipes from `/api/recipes` → Displays in responsive grid/list with infinite scroll → Cards link to `/recipes/[slug]`
3. **Recipe Route** (`/recipes/[slug]`)
   - Page component: Generates metadata (OpenGraph, title) via server-side Supabase query
   - Layout component: Extracts slug from pathname → Uses `useRecipe` hook → Fetches recipe data via Supabase → Renders recipe components
   - Layout persists across route changes, preventing carousel remounting
4. **Next Recipe Navigation**:
   - Desktop: `RecipeSideNav` or keyboard right arrow → Fetches `/api/recipes?from={slug}` → Gets next in feed order → `router.push('/recipes/[slug]')`
   - Mobile: Swipe left → Carousel triggers same navigation flow
   - History: Updates session storage with new slug in stack
5. **Previous Recipe Navigation**:
   - Desktop: `RecipeSideNav` or keyboard left arrow → `router.back()` (if history exists)
   - Mobile: Swipe right → Carousel moves backward in history → `router.back()`
   - History: Updates session storage index
6. **History Management**:
   - On route change, layout syncs history with `document.referrer` check
   - If same-origin recipe referrer → appends to existing stack
   - If no/external referrer → resets stack
   - Forward navigation reuses history entries (no API call needed)
7. **Back to Feed**: Button in top-left navigates to `/feed` (preserves feed scroll position via browser history)
8. **Supabase**: Trigger `generate_recipe_slug` ensures unique slugs with `-2`, `-3`, etc. suffixes
9. **Favorites**: Stored in browser `localStorage` (key: `recipe-favorites`) as array of slugs, persist across page reloads

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
