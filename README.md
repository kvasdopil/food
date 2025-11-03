## Stack

- [Next.js](https://nextjs.org) App Router + React Server Components
- [Tailwind CSS](https://tailwindcss.com) styling
- [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- [idb](https://github.com/jakearchibald/idb) for IndexedDB persistence
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
   - `GEMINI_API_KEY`: Google Gemini API key (for recipe text generation, refinement, and prompt enhancement - used by `/api/recipes/generate`, `/api/recipes/[slug]/refine`, and `/api/recipes/[slug]/generate-image` endpoints)
   - `FIREFLY_API_TOKEN`: Adobe Firefly API bearer token (for image generation - used by `/api/recipes/[slug]/generate-image` endpoint)
   - `FIREFLY_API_KEY`: Adobe Firefly API key (defaults to "clio-playground-web" if not set, used by `/api/recipes/[slug]/generate-image` endpoint)
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
   - `SUPABASE_SERVICE_ROLE_KEY` (required for storage and database operations)
   - `EDIT_TOKEN` (required for protected API endpoints)
   - `GEMINI_API_KEY` (required for recipe generation and image prompt enhancement)
   - `FIREFLY_API_TOKEN` (required for image generation endpoint)
   - `FIREFLY_API_KEY` (optional, defaults to "clio-playground-web")

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

- **US-24**: As a user, I want the app to be mobile-first with responsive design so it works well on phones, tablets, and desktops. ✅ **Implemented**: Mobile-first design with breakpoints at 640px (sm) and 1280px (xl).
- **US-25**: As a user, I want to swipe left/right on mobile to navigate between recipes so I can use touch gestures naturally. ✅ **Implemented**: Swipeable carousel on mobile devices (< 640px).
- **US-26**: As a user, I want different layouts optimized for mobile vs desktop (carousel on mobile, standard view on desktop) so the UI is appropriate for each screen size. ✅ **Implemented**: Carousel on mobile, centered recipe view on medium/desktop, side navigation buttons on extra-large screens.

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
- **Shuffled feed order**: Recipes in the feed are shuffled deterministically based on the current date. The same date produces the same shuffle order, ensuring a stable sequence throughout the day. The shuffle order changes daily, providing variety while maintaining consistency during browsing sessions.
- Tag filtering: Users can click tags on recipe cards to toggle filters. Active filters are displayed at the top of the feed with remove buttons. Filters persist in the URL using `+` separator (e.g., `/feed?tags=vegetarian+italian`). Tag filtering works on both desktop (`feed/page.tsx`) and mobile (`feed-card.tsx`) views.
- Dynamic route `src/app/recipes/[slug]/page.tsx` handles metadata generation only; rendering is handled by the layout.
- Layout `src/app/recipes/layout.tsx` manages the persistent carousel wrapper to prevent remounting during navigation, and includes a back-to-feed button in the top-left corner.
- Navigation history checks use `document.referrer` to ensure same-origin navigation (prevents "about:blank" issues). Previous navigation is disabled/hidden when there's no same-origin history.
- Supabase provides recipe data via table queries; types generated in `src/types/supabase.ts`.
- Authenticated POST to `/api/recipes` upserts recipes from JSON payloads that match the YAML schema. Requires a `Bearer` token that matches `EDIT_TOKEN`.
- POST to `/api/recipes/generate` generates recipe content (ingredients, instructions, image prompts) using Gemini API. Does not save to database. Always returns the first generated variant (no refinement). Requires `EDIT_TOKEN` authentication and `GEMINI_API_KEY` on the server.
- POST to `/api/recipes/[slug]/refine` evaluates and refines an existing recipe in the database. Evaluates the recipe, and if issues are found, generates a refined version and updates it. Requires `EDIT_TOKEN` authentication and `GEMINI_API_KEY` on the server.
- POST to `/api/recipes/[slug]/generate-image` generates and uploads images for existing recipes. Requires `EDIT_TOKEN`, `FIREFLY_API_TOKEN`, and `GEMINI_API_KEY` on the server. Handles prompt enrichment, Firefly image generation, storage upload, and database update.

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
- Responsive breakpoints:
  - **Mobile (< 640px / sm)**: Content handled by root-level mobile carousel wrapper
  - **Medium/Desktop (≥ 640px / sm+)**: Recipe content displayed and centered with max-width 5xl
  - **Extra Large (≥ 1280px / xl+)**: Side navigation buttons (prev/next) appear, floating outside centered content
- Contains:
  - Back-to-feed button (floating, top-left corner, absolute positioned)
  - Keyboard navigation handler (global)
  - Side navigation buttons (prev/next) for desktop XL+ only
  - Mobile swipeable carousel wrapper (handled by root layout)
  - Centered recipe view for medium and desktop screens

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
- **Only visible on XL+ screens (≥1280px)**: Positioned absolutely outside the centered content area

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

- Recipes are shuffled deterministically based on the current date (using a seeded random number generator). The same date produces the same shuffle order, ensuring a stable sequence throughout the day. The shuffle order changes daily.
- Supports two pagination modes:
  - `?page=N` → Traditional page-based pagination (20 items per page)
  - `?from={slug}` → Slug-based pagination matching shuffled feed order
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
├── Back to Feed button (floating, absolute positioned, top-left)
├── KeyboardNav (global keyboard shortcuts)
├── Mobile (< 640px / sm): Content handled by root-level MobileCarouselWrapper
│   └── RecipeSwipeableCarousel
│       └── SwipeableCarousel
│           └── Recipe component (preloaded items)
├── Medium/Desktop (≥ 640px / sm+): Centered Recipe component
│   └── Recipe component (centered, max-w-5xl)
│       ├── RecipeImage
│       ├── Description (with tags)
│       ├── Ingredients
│       └── Instructions
└── Desktop XL+ (≥ 1280px / xl+): Side navigation buttons
    ├── RecipeSideNav (previous) - floating left of content
    └── RecipeSideNav (next) - floating right of content
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
  - ✅ Recipe refinement endpoint - **Implemented**: `/api/recipes/[slug]/refine` endpoint for evaluating and improving existing recipes
  - Support recipe variations (e.g., vegetarian versions of existing meals)

- **Performance & UX**:
  - ✅ Centralized recipe storage with IndexedDB persistence - **Implemented**: Recipe data cached locally for instant loading, offline access, and improved user experience
  - ✅ Proper loading preview/skeleton for recipe pages - **Implemented**: Shows cached partial data immediately while loading full recipe data
  - ✅ Feed preloader with cached data - **Implemented**: Feed shows cached recipes immediately on reload, preventing "no recipes found" flash
  - Implement SSR for better performance and SEO
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
- `src/app/api/recipes/route.ts`: API endpoint returning paginated recipes (20 per page) with pagination metadata. Recipes are shuffled deterministically based on the current date (same date = same order). Supports `page` parameter for traditional pagination, `from={slug}` for slug-based pagination, and `tags` parameter for filtering by tags (format: `tags=tag1+tag2`).
- `src/lib/shuffle-utils.ts`: Utility functions for deterministic shuffling. Provides `seededShuffle()` for shuffling arrays with a seed value and `getDateSeed()` for generating a seed based on the current date.
- `src/app/api/recipes/generate/route.ts`: API endpoint for generating recipe content (ingredients, instructions, image prompts) using Gemini API. Requires `EDIT_TOKEN` authentication. Does not save to database, returns generated recipe data.
- `src/lib/recipe-store.ts`: Centralized recipe storage with IndexedDB persistence. Stores partial recipe data (from feed) and full recipe data (from detail pages). Automatically loads cached recipes on app initialization and persists new data as it's fetched. Provides methods to retrieve cached partial or full recipe data.

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

2. **Upload Recipe to Database** (required before image generation):

   ```bash
   yarn ts-node scripts/upload-recipe.ts data/recipes/<slug>/<slug>.yaml --token "$EDIT_TOKEN"
   ```

   This uploads the recipe to the database. The recipe must exist in the database before generating images.

3. **Generate Recipe Image** (using API endpoint):

   ```bash
   yarn ts-node scripts/generate-recipe-image.ts <slug>
   ```

   This script:
   - Calls the `/api/recipes/[slug]/generate-image` endpoint
   - The endpoint loads recipe data from the database
   - Enriches the image prompt using Gemini API
   - Generates an image using Firefly API (async, with polling)
   - Uploads the image to Supabase Storage with hashed filename
   - Updates the recipe's `image_url` in the database

   **Required:** `EDIT_TOKEN` (for API authentication)
   **Optional:** 
   - `--endpoint <url>` to specify API URL (defaults to `http://localhost:3000` or `RECIPE_API_URL` env var)
   - `--firefly-key <key>` to pass Firefly API key via header (defaults to `FIREFLY_API_KEY` env var or "clio-playground-web")
   - `--save-to <path>` to download and save the image locally

   The API endpoint requires `FIREFLY_API_TOKEN`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), and optionally `FIREFLY_API_KEY` configured on the server.

### Uploading Recipes

Upload recipe to the database (defaults to `http://localhost:3000`):

```bash
yarn ts-node scripts/upload-recipe.ts data/recipes/<slug>/<slug>.yaml --token "$EDIT_TOKEN"
```

The script will:

1. Automatically find the corresponding image file (`{slug}.jpg`, `.jpeg`, `.png`, or `.webp`) in the same directory if it exists
2. Upload the image to Supabase Storage with hashed filename (`{slug}.{hash}.jpg`) if image file is found
3. Upload the recipe YAML to the database with the image URL (if image was uploaded)
4. If the recipe already exists, its image URL is automatically updated

- Recipe metadata lives in `data/recipes/<slug>/` (YAML files + images). Storage uploads land in the `recipe-images` bucket by default with hashed filenames for versioning. Ingredient entries should use `{ name, amount, notes }` with metric abbreviations (`g`, `ml`, `tsp`, etc.).

### Recipe Generation Scripts

- **`scripts/generate-recipe-yaml.ts`**: Generates recipe YAML with image prompts
  - Calls `/api/recipes/generate` endpoint (which uses Gemini API server-side)
  - Generates recipe content (ingredients, instructions) and image prompts (returns first variant, no refinement)
  - Saves YAML file to `data/recipes/<slug>/<slug>.yaml`
  - Requires `EDIT_TOKEN` for authentication
  - Supports `--endpoint` flag to specify API URL
- **`scripts/recipe-evaluator.ts`**: Evaluates and refines recipes in the database
  - Calls `/api/recipes/[slug]/refine` endpoint
  - Evaluates recipe quality and automatically refines if issues are found
  - Updates recipe in database with refined version
  - Accepts either a recipe slug or YAML file path (extracts slug automatically)
  - Supports `--endpoint` and `--token` flags
  - Requires `EDIT_TOKEN` for authentication
- **`scripts/generate-recipe-image.ts`**: Generates images for recipes in the database
  - Calls `/api/recipes/[slug]/generate-image` endpoint
  - Endpoint handles prompt enrichment, Firefly image generation, upload, and database update
  - Requires recipe to exist in database first
  - Supports `--endpoint`, `--firefly-key`, and `--save-to` options

### Recipe Upload CLI & API

- `scripts/upload-recipe.ts` is a unified script that uploads both the recipe image and YAML in one command:
  - Finds the image file automatically (looks for `{slug}.jpg`, `.jpeg`, `.png`, or `.webp` in the same directory as the YAML)
  - Uploads image via `/api/images` endpoint (which automatically updates existing recipes)
  - Uploads recipe via `/api/recipes` endpoint with the image URL
  - Use `--skip-image` to skip image upload and only upload the recipe (useful if image URL is already in YAML)
- The command reads `EDIT_TOKEN` from `--token`, the environment, or `.env.local`, and falls back to `http://localhost:3000` unless `--endpoint` or `RECIPE_API_URL` is provided.

### API Endpoints

- **`POST /api/recipes`**: Creates or updates a recipe in the database. Accepts normalized recipe payloads, upserting by slug. Requests must include `Authorization: Bearer <EDIT_TOKEN>`; the server rejects missing or mismatched tokens with `401`.
- **`POST /api/recipes/generate`**: Generates recipe content (ingredients, instructions, image prompts) using Gemini API. Does not save to database. Always returns the first generated variant without refinement. Requires `Authorization: Bearer <EDIT_TOKEN>` and `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) configured on the server. Returns recipe data in the same format as `POST /api/recipes`.
- **`POST /api/recipes/[slug]/refine`**: Evaluates and refines an existing recipe in the database. Evaluates the recipe against quality standards, and if issues are found, generates a refined version and updates the database. Returns evaluation results and the updated recipe. Requires `Authorization: Bearer <EDIT_TOKEN>` and `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) configured on the server.
- **`POST /api/recipes/[slug]/generate-image`**: Generates and uploads an image for an existing recipe. Loads recipe from database, enriches prompt using Gemini API, generates image with Firefly API, uploads to Supabase Storage, and updates recipe's `image_url` in database. Requires `Authorization: Bearer <EDIT_TOKEN>`, `FIREFLY_API_TOKEN`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) on server. Optional `x-firefly-key` header for Firefly API key (defaults to `FIREFLY_API_KEY` env var or "clio-playground-web").
- **`POST /api/images`**: Accepts image uploads with `slug` and `file` (multipart/form-data), automatically updating recipe `image_url` if the recipe exists. Requires `Authorization: Bearer <EDIT_TOKEN>`.

### Typical Workflow

1. Generate recipe YAML: `yarn ts-node scripts/generate-recipe-yaml.ts "Meal Name" --description "..." --tags "tag1,tag2"`
2. Upload to database: `yarn ts-node scripts/upload-recipe.ts data/recipes/<slug>/<slug>.yaml`
3. (Optional) Refine recipe: `yarn ts-node scripts/recipe-evaluator.ts <slug>` - evaluates and automatically refines the recipe if issues are found
4. Generate recipe image: `yarn ts-node scripts/generate-recipe-image.ts <slug>`

## Data Flow

1. **Home Route** (`/`) → Server redirects to `/feed`
2. **Feed Route** (`/feed`) →
   - Desktop: `FeedPageContent` component fetches paginated recipes from `/api/recipes` (recipes are shuffled deterministically by date, supports `?tags=tag1+tag2` for filtering) → Stores partial recipe data (image, name, description, tags) in centralized cache → Displays in responsive grid with infinite scroll → Shows cached recipes immediately if available → Active tag filters shown at top → Cards link to `/recipes/[slug]`
   - Mobile: `FeedCard` component (via `mobile-carousel-wrapper`) fetches paginated recipes with same date-based shuffle and tag filtering support → Stores partial recipe data in centralized cache → Displays single-column cards → Shows cached recipes immediately if available → Active tag filters shown at top → Cards link to `/recipes/[slug]`
3. **Tag Filtering**:
   - User clicks tag on recipe card → `toggleTagInUrl` utility adds/removes tag from URL → `useTags` hook parses active tags → Feed reloads with filtered recipes → Active tags displayed at top with remove buttons
4. **Recipe Route** (`/recipes/[slug]`)
   - Page component: Generates metadata (OpenGraph, title) via server-side Supabase query
   - Layout component: Extracts slug from pathname → Uses `useRecipe` hook → Checks centralized cache for partial data (image, name, description, tags) → Shows cached partial data immediately if available → Fetches full recipe data via Supabase → Stores full data in centralized cache → Renders recipe components
   - Layout persists across route changes, preventing carousel remounting
   - Loading experience: If cached partial data exists, shows image, name, description, and tags immediately while fetching ingredients and instructions (only shows skeletons for missing parts)
   - Responsive rendering:
     - **Mobile (< 640px)**: Content handled by root-level `MobileCarouselWrapper` with swipeable carousel
     - **Medium/Desktop (≥ 640px)**: Recipe content displayed centered with max-width 5xl
     - **XL+ (≥ 1280px)**: Side navigation buttons appear, floating outside centered content area
5. **Next Recipe Navigation**:
   - Desktop: `RecipeSideNav` or keyboard right arrow → Fetches `/api/recipes?from={slug}` → Gets next in shuffled feed order → `router.push('/recipes/[slug]')`
   - Mobile: Swipe left → Carousel triggers same navigation flow
   - History: Updates session storage with new slug in stack
   - Note: Feed order is shuffled based on current date, so the sequence remains stable throughout the day
6. **Previous Recipe Navigation**:
   - Desktop: `RecipeSideNav` or keyboard left arrow → `router.back()` (if history exists)
   - Mobile: Swipe right → Carousel moves backward in history → `router.back()`
   - History: Updates session storage index
7. **History Management**:
   - On route change, layout syncs history with `document.referrer` check
   - If same-origin recipe referrer → appends to existing stack
   - If no/external referrer → resets stack
   - Forward navigation reuses history entries (no API call needed)
8. **Back to Feed**: Button in top-left navigates to `/feed` (preserves feed scroll position via browser history)
9. **Supabase**: Trigger `generate_recipe_slug` ensures unique slugs with `-2`, `-3`, etc. suffixes
10. **Favorites**: Stored in browser `localStorage` (key: `recipe-favorites`) as array of slugs, persist across page reloads
11. **Recipe Caching & Persistence**:
    - Centralized recipe store (`src/lib/recipe-store.ts`) manages both partial data (from feed) and full data (from detail pages)
    - Partial data (image, name, description, tags) stored automatically when feed loads
    - Full data (includes ingredients and instructions) stored when recipe detail pages load
    - Data persists to IndexedDB for offline access and faster loading on subsequent visits
    - Feed and recipe pages show cached data immediately while fetching fresh data
    - Prevents "no recipes found" flash by showing cached recipes during reloads

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
