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
   - `EDIT_TOKEN`: shared bearer token required for protected API endpoints (e.g. recipe generation, imports)
   - `GEMINI_API_KEY`: Google Gemini API key (for recipe text generation and prompt enhancement - used by `/api/recipes/generate` endpoint)
   - `FIREFLY_API_TOKEN`: Adobe Firefly API bearer token (for image generation)
   - `FIREFLY_API_KEY`: Adobe Firefly API key (defaults to "clio-playground-web" if not set)
   - _(optional)_ `RECIPE_STORAGE_BUCKET`: overrides the default `recipe-images` bucket name
   - _(optional)_ `RECIPE_API_URL`: API endpoint URL for scripts (defaults to `http://localhost:3000`)

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

4. In the Vercel dashboard, add the following environment variables under **Settings → Environment Variables**, then redeploy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EDIT_TOKEN` (required for recipe generation endpoint)
   - `GEMINI_API_KEY` (required for recipe generation endpoint)

## Requirements

### User Stories

#### Navigation & Browsing

- **US-1**: As a user, I want the home route (`/`) to redirect to the recipe feed so I can immediately see available recipes.
- **US-2**: As a user, I want to browse recipes in a paginated feed with infinite scroll so I can discover recipes without clicking through pages.
- **US-3**: As a user, I want to view recipes in a responsive grid/list layout (1 column on mobile, up to 4 columns on desktop) so the interface works well on all devices.
- **US-4**: As a user, I want to click on a recipe card to view full recipe details so I can see ingredients and instructions.
- **US-5**: As a user, I want to navigate to the next recipe in feed order (desktop side buttons, mobile swipe left) so I can browse through recipes sequentially.
- **US-6**: As a user, I want to navigate to the previous recipe using browser history (desktop side buttons, mobile swipe right) so I can go back to recipes I've already viewed.
- **US-7**: As a user, I want to use keyboard shortcuts (left/right arrows) to navigate between recipes so I can browse hands-free on desktop.
- **US-8**: As a user, I want a back-to-feed button on recipe pages so I can easily return to browsing all recipes.
- **US-9**: As a user, I want recipe navigation to respect my browser history so forward/backward navigation works naturally.

#### Recipe Display

- **US-10**: As a user, I want to see recipe images, names, and descriptions on recipe cards so I can quickly identify interesting recipes.
- **US-11**: As a user, I want to view full recipe details including ingredients and step-by-step instructions on dedicated recipe pages.
- **US-12**: As a user, I want each recipe to have a unique, shareable URL (`/recipes/[slug]`) so I can bookmark or share specific recipes.
- **US-13**: As a user, I want recipes to display tags so I can see what categories or dietary restrictions apply.

#### Tag Filtering

- **US-14**: As a user, I want to click on tags in recipe cards to filter the feed by that tag so I can find recipes matching my preferences. ✅ **Implemented**: Tags toggle on click (add if not present, remove if already filtered).
- **US-15**: As a user, I want to combine multiple tags (e.g., `/feed?tags=vegetarian+italian`) so I can filter recipes by multiple criteria at once. ✅ **Implemented**: Multiple tags are separated by `+` in the URL.
- **US-16**: As a user, I want to see active tag filters displayed at the top of the feed so I know what filters are currently applied. ✅ **Implemented**: Filter section shows active tags with remove buttons on both desktop and mobile.
- **US-17**: As a user, I want to remove individual tag filters or clear all filters so I can adjust my search criteria. ✅ **Implemented**: Individual tags can be removed via X button; "Clear filters" button removes all active filters.
- **US-18**: As a user, I want tag filters to persist in the URL so I can bookmark filtered views and share them with others. ✅ **Implemented**: Tag filters are stored in URL query parameters.
- **US-19**: As a user, I want tags to be clickable buttons so I can easily filter recipes. ✅ **Implemented**: Tags are clickable buttons that toggle filters.

#### Favorites

- **US-20**: As a user, I want to favorite/unfavorite recipes using a heart button so I can save recipes I'm interested in.
- **US-21**: As a user, I want my favorites to persist across page reloads (stored in localStorage) so my saved recipes aren't lost when I refresh.

#### Sharing

- **US-22**: As a user, I want to share recipes using native share functionality when available (Web Share API) so I can easily share recipes with others.
- **US-23**: As a user, I want a fallback copy-link option when native sharing isn't available so I can share recipes on any device.

#### Responsive Design

- **US-24**: As a user, I want the app to be mobile-first with responsive design so it works well on phones, tablets, and desktops.
- **US-25**: As a user, I want to swipe left/right on mobile to navigate between recipes so I can use touch gestures naturally.
- **US-26**: As a user, I want different layouts optimized for mobile vs desktop (carousel on mobile, standard view on desktop) so the UI is appropriate for each screen size.

#### Performance & UX

- **US-27**: As a user, I want recipes to load quickly with pagination (20 per page) so I don't wait for all recipes to load at once.
- **US-28**: As a user, I want infinite scroll to automatically load more recipes as I scroll so I can browse continuously without clicking "next page".
- **US-29**: As a user, I want recipe navigation to maintain feed order so I can browse through recipes in the same order I see them in the feed.

### Planned Features

The following user stories are planned but not yet implemented:

- **US-30**: As a user, I want to see a dedicated page listing all my favorited recipes so I can easily access my saved recipes.
- **US-31**: As a user, I want to search for recipes by name or keywords so I can quickly find specific recipes.
- **US-32**: As a user, I want the feed to preserve scroll position when navigating back from a recipe page so I don't lose my place while browsing.
- **US-33**: As a user, I want to see recipe variations (e.g., vegetarian versions) so I can find alternative versions of recipes I like.
- **US-34**: As a user, I want to see prep time and cooking time for recipes so I can plan my cooking schedule.
- **US-35**: As a user, I want to see serving sizes and nutrition information for recipes so I can make informed dietary choices.

## Project Status

- Home route `/` server-redirects to `/feed`.
- Feed route `/feed` displays a scrollable grid/list of recipes with pagination (20 per page), infinite scroll, and favorite functionality. Desktop shows up to 4 columns in a grid with gaps and shadows; mobile uses the `FeedCard` component with single-column full-width cards.
- Tag filtering: Users can click tags on recipe cards to toggle filters. Active filters are displayed at the top of the feed with remove buttons. Filters persist in the URL using `+` separator (e.g., `/feed?tags=vegetarian+italian`). Tag filtering works on both desktop (`feed/page.tsx`) and mobile (`feed-card.tsx`) views.
- Dynamic route `src/app/recipes/[slug]/page.tsx` handles metadata generation only; rendering is handled by the layout.
- Layout `src/app/recipes/layout.tsx` manages the persistent carousel wrapper to prevent remounting during navigation, and includes a back-to-feed button in the top-left corner.
- Navigation history checks use `document.referrer` to ensure same-origin navigation (prevents "about:blank" issues). Previous navigation is disabled/hidden when there's no same-origin history.
- Supabase provides recipe data via table queries; types generated in `src/types/supabase.ts`.
- Authenticated POST to `/api/recipes` upserts recipes from JSON payloads that match the YAML schema. Requires a `Bearer` token that matches `EDIT_TOKEN`.
- POST to `/api/recipes/generate` generates recipe content (ingredients, instructions, image prompts) using Gemini API. Does not save to database. Requires `EDIT_TOKEN` authentication and `GEMINI_API_KEY` on the server.

## Screen Structure & Navigation

### Route Hierarchy

The app has three main routes:

1. **`/` (Home)** → Server redirects to `/feed`
2. **`/feed`** → Recipe feed page with paginated grid/list and tag filtering (supports `?tags=tag1+tag2` query parameter)
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
├── Desktop: FeedPageContent
│   ├── Active Tags Filter Section (when tags are active)
│   └── RecipeFeedCard (multiple, clickable links)
│       ├── Image with title overlay
│       ├── Description
│       ├── Tags (clickable buttons, toggle filters)
│       └── Favorite button (localStorage)
└── Mobile: FeedCard (via mobile-carousel-wrapper)
    ├── Active Tags Filter Section (when tags are active)
    └── RecipeFeedCard (same structure as desktop)

Tag Filtering Infrastructure
├── useTags hook (src/hooks/useTags.ts)
│   ├── Parses active tags from URL
│   ├── Provides removeTag, clearAllTags functions
│   └── Returns activeTags array
└── tag-utils (src/lib/tag-utils.ts)
    ├── parseTagsFromUrl - Parse tags from URLSearchParams
    ├── parseTagsFromQuery - Parse tags from query string (API)
    ├── toggleTagInUrl - Toggle tag in current URL
    └── buildFeedUrlWithTags - Build feed URL with tags

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
  - ✅ Tag filtering functionality - **Implemented**: Tags can be clicked to filter recipes, active filters shown at top, filters persist in URL
  - Add dedicated page to list all liked/favorited meals
  - Search functionality

- **Recipe Management**:
  - ✅ Add new recipes via agent/API integration (with secure Vercel token authentication) - **Implemented**: `/api/recipes/generate` endpoint
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
- `src/app/feed/page.tsx`: client component displaying paginated recipe feed with infinite scroll and tag filtering (desktop view).
- `src/components/feed-card.tsx`: client component displaying paginated recipe feed for mobile view with tag filtering support.
- `src/components/recipe-feed-card.tsx`: recipe card component for feed page with image, title overlay, description, clickable tags (toggle filters), and favorite button.
- `src/hooks/useTags.ts`: React hook for managing tags in feed context. Parses tags from URL, provides remove/clear functions.
- `src/lib/tag-utils.ts`: Utility functions for parsing tags from URLs and building tag URLs. Used by both client components and API routes.
- `src/app/recipes/layout.tsx`: client layout component that manages the persistent carousel, navigation, recipe rendering, and back-to-feed button. Prevents carousel remounting during route changes.
- `src/app/recipes/[slug]/page.tsx`: server component that only handles metadata generation (OpenGraph, title, etc.). Returns `null` as layout handles all rendering.
- `src/app/recipes/[slug]/client/recipe-swipeable-carousel.tsx`: carousel component managing swipe navigation with preloaded recipes. Maintains state across navigation using module-level snapshot.
- `src/components/*`: client-side interactivity (share, favorite, nav, keyboard shortcuts).
- `src/app/api/recipes/route.ts`: API endpoint returning paginated recipes (20 per page) with pagination metadata. Supports `page` parameter for traditional pagination, `from={slug}` for slug-based pagination, and `tags` parameter for filtering by tags (format: `tags=tag1+tag2`).
- `src/app/api/recipes/generate/route.ts`: API endpoint for generating recipe content (ingredients, instructions, image prompts) using Gemini API. Requires `EDIT_TOKEN` authentication. Does not save to database, returns generated recipe data.

## Recipe Asset Workflow

### Generating Recipes

The recipe generation process is split into two steps:

1. **Generate Recipe YAML** (using `/api/recipes/generate` endpoint):

   ```bash
   yarn ts-node scripts/generate-recipe-yaml.ts "Meal Name" --description "..." --tags "tag1,tag2"
   ```

   This script:
   - Calls the `/api/recipes/generate` endpoint (which uses Gemini API server-side)
   - Generates recipe content (ingredients, instructions) using Gemini API
   - Creates base and enhanced image prompts using Gemini API
   - Saves the recipe as YAML to `data/recipes/<slug>/<slug>.yaml`

   **Required:** `EDIT_TOKEN` (for API authentication)
   **Optional:** `--endpoint <url>` to specify API URL (defaults to `http://localhost:3000` or `RECIPE_API_URL` env var)
   
   The API endpoint requires `GEMINI_API_KEY` to be configured on the server (Vercel environment variables for production).

2. **Generate Recipe Image** (using Firefly API):

   ```bash
   yarn ts-node scripts/generate-recipe-image.ts data/recipes/<slug>/<slug>.yaml
   ```

   This script:
   - Reads the YAML file and extracts the image prompt (uses `enhanced` if available, falls back to `base`)
   - Generates an image using Firefly API (async, with polling)
   - Saves the image as `{slug}.jpg` in the same directory as the YAML
   - Updates `metadata.json` with image generation info

   **Required:** `FIREFLY_API_TOKEN` (and optionally `FIREFLY_API_KEY`, defaults to "clio-playground-web")

### Uploading Recipes

Upload recipe and image together to the API (defaults to `http://localhost:3000`):

```bash
yarn ts-node scripts/upload-recipe.ts data/recipes/<slug>/<slug>.yaml --token "$EDIT_TOKEN"
```

The script will:

1. Automatically find the corresponding image file (`{slug}.jpg`, `.jpeg`, `.png`, or `.webp`) in the same directory
2. Upload the image to Supabase Storage with hashed filename (`{slug}.{hash}.jpg`)
3. Upload the recipe YAML to the database with the image URL
4. If the recipe already exists, its image URL is automatically updated

- Recipe metadata lives in `data/recipes/<slug>/` (YAML files + images). Storage uploads land in the `recipe-images` bucket by default with hashed filenames for versioning. Ingredient entries should use `{ name, amount, notes }` with metric abbreviations (`g`, `ml`, `tsp`, etc.).

### Recipe Generation Scripts

- **`scripts/generate-recipe-yaml.ts`**: Generates recipe YAML with image prompts
  - Calls `/api/recipes/generate` endpoint (which uses Gemini API server-side)
  - Generates recipe content (ingredients, instructions) and image prompts
  - Saves YAML file to `data/recipes/<slug>/<slug>.yaml`
  - Requires `EDIT_TOKEN` for authentication
  - Supports `--endpoint` flag to specify API URL
- **`scripts/generate-recipe-image.ts`**: Generates images from YAML files
  - Uses Firefly API (V5) for image generation
  - Reads image prompts from YAML file
  - Supports async generation with polling for completion
  - Saves generated images as JPEG files

### Recipe Upload CLI & API

- `scripts/upload-recipe.ts` is a unified script that uploads both the recipe image and YAML in one command:
  - Finds the image file automatically (looks for `{slug}.jpg`, `.jpeg`, `.png`, or `.webp` in the same directory as the YAML)
  - Uploads image via `/api/images` endpoint (which automatically updates existing recipes)
  - Uploads recipe via `/api/recipes` endpoint with the image URL
  - Use `--skip-image` to skip image upload and only upload the recipe (useful if image URL is already in YAML)
- The command reads `EDIT_TOKEN` from `--token`, the environment, or `.env.local`, and falls back to `http://localhost:3000` unless `--endpoint` or `RECIPE_API_URL` is provided.

### API Endpoints

- **`POST /api/recipes`**: Creates or updates a recipe in the database. Accepts normalized recipe payloads, upserting by slug. Requests must include `Authorization: Bearer <EDIT_TOKEN>`; the server rejects missing or mismatched tokens with `401`.
- **`POST /api/recipes/generate`**: Generates recipe content (ingredients, instructions, image prompts) using Gemini API. Does not save to database. Requires `Authorization: Bearer <EDIT_TOKEN>` and `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) configured on the server. Returns recipe data in the same format as `POST /api/recipes`.
- **`POST /api/images`**: Accepts image uploads with `slug` and `file` (multipart/form-data), automatically updating recipe `image_url` if the recipe exists. Requires `Authorization: Bearer <EDIT_TOKEN>`.

### Typical Workflow

1. Generate recipe YAML: `yarn ts-node scripts/generate-recipe-yaml.ts "Meal Name" --description "..." --tags "tag1,tag2"`
2. Generate recipe image: `yarn ts-node scripts/generate-recipe-image.ts data/recipes/<slug>/<slug>.yaml`
3. Upload to database: `yarn ts-node scripts/upload-recipe.ts data/recipes/<slug>/<slug>.yaml`

## Data Flow

1. **Home Route** (`/`) → Server redirects to `/feed`
2. **Feed Route** (`/feed`) → 
   - Desktop: `FeedPageContent` component fetches paginated recipes from `/api/recipes` (supports `?tags=tag1+tag2` for filtering) → Displays in responsive grid with infinite scroll → Active tag filters shown at top → Cards link to `/recipes/[slug]`
   - Mobile: `FeedCard` component (via `mobile-carousel-wrapper`) fetches paginated recipes with same tag filtering support → Displays single-column cards → Active tag filters shown at top → Cards link to `/recipes/[slug]`
3. **Tag Filtering**: 
   - User clicks tag on recipe card → `toggleTagInUrl` utility adds/removes tag from URL → `useTags` hook parses active tags → Feed reloads with filtered recipes → Active tags displayed at top with remove buttons
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
- Recipes can be uploaded via the API endpoint (see Recipe Asset Workflow section above).
- Regenerate TypeScript types whenever the schema changes:

  ```bash
  supabase gen types typescript --project-id <project-ref> --schema public > src/types/supabase.ts
  ```

- Extend the schema (prep time, servings, user auth) in new migrations as requirements grow.

## Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
