# Recipe Authors Feature Plan

## Overview
Add author attribution to recipes by storing the creator's name and email, and displaying "by {username}" on recipe pages after the description. Also add a "My Recipes" filter in the user menu to show only recipes created by the current user.

## Current State Analysis

### Database Schema
- Recipes table exists with: `id`, `slug`, `name`, `description`, `ingredients`, `instructions`, `image_url`, `tags`, `created_at`, `updated_at`, `prep_time_minutes`, `cook_time_minutes`
- No author/user fields currently exist

### Authentication
- Supabase auth is configured with Google OAuth
- User info available:
  - `user.id` - unique user ID
  - `user.email` - user email address
  - `user.user_metadata?.full_name` - full name from Google OAuth
- Display name logic: `user.user_metadata?.full_name || user.email?.split("@")[0] || "User"`

### Recipe Creation Flow
- POST `/api/recipes` endpoint handles recipe creation
- Uses `authenticateRequest()` which returns `userId` and `userEmail`
- Currently saves recipe data but doesn't store author information

### Recipe Display
- Recipe page displays: Image → Description → Ingredients → Instructions
- Description component (`src/components/recipe/description.tsx`) shows description and tags
- Need to add author attribution after description

## Implementation Plan - Split into Testable Phases

The implementation is split into 4 testable phases. Each phase can be completed and tested independently before moving to the next.

---

## Phase 1: Database Schema & Types Foundation
**Goal**: Add author fields to database and TypeScript types  
**Testability**: Verify schema changes and type definitions  
**Can proceed to Phase 2**: ✅ After database migration and types are updated

### Step 1: Database Migration
**File**: `supabase/migrations/[timestamp]_add_recipe_authors.sql`

- Add nullable columns to `recipes` table:
  - `author_name` (text, nullable) - display name of the recipe creator
  - `author_email` (text, nullable) - email of the recipe creator
- Add index on `author_email` for potential future queries
- Make columns nullable to handle existing recipes without authors

```sql
ALTER TABLE public.recipes
ADD COLUMN author_name text,
ADD COLUMN author_email text;

CREATE INDEX IF NOT EXISTS recipes_author_email_idx ON public.recipes (author_email);
```

### Step 2: Update TypeScript Types
**Files**: 
- `src/types/supabase.ts` - update Recipes table Row, Insert, Update types
- `src/types/recipes.ts` - update GeneratedRecipe and RecipeListItem types if needed

Add `author_name` and `author_email` fields to:
- `Tables["recipes"]["Row"]`
- `Tables["recipes"]["Insert"]`
- `Tables["recipes"]["Update"]`

**Phase 1 Testing Checklist**:
- [ ] Database migration runs successfully
- [ ] Verify columns exist: `SELECT author_name, author_email FROM recipes LIMIT 1;`
- [ ] TypeScript types compile without errors
- [ ] No runtime errors from missing type definitions

---

## Phase 2: Backend - Save Author Info
**Goal**: Save author information when recipes are created or updated  
**Testability**: Create/update recipes and verify author fields in database  
**Can proceed to Phase 3**: ✅ After new recipes save author info correctly

### Step 3: Update Recipe Creation API
**File**: `src/app/api/recipes/route.ts`

In the `POST` handler:
- Check if recipe exists (already done: `existingRecipe` query around line 423)
- Extract user info from `authenticateRequest()` result (already available)
- **Critical**: When updating an existing recipe:
  - Expand `existingRecipe` query to also select `author_name` and `author_email` (currently only selects `image_url`)
  - **Preserve existing author fields** - Include them in `dbPayload` with existing values
  - NEVER overwrite author fields during updates, even if edited by another user or script
- When creating a NEW recipe (when `existingRecipe` is null):
  - **Important**: Only save author info when authenticated via Supabase session (not EDIT_TOKEN)
  - When `auth.userId` and `auth.userEmail` are present (Supabase auth):
    - Get display name using same logic as `UserAvatar`: `user.user_metadata?.full_name || user.email?.split("@")[0] || "User"`
    - Add `author_name` and `author_email` to `dbPayload`
  - When auth uses EDIT_TOKEN (scripted/automated creation):
    - Leave `author_name` and `author_email` as `null` explicitly
    - This ensures scripted recipes never show author attribution

**Key Principle**: Author fields are **immutable** after initial creation. Once set (or set to null), they should never change, regardless of who edits the recipe.

**Note**: Scripted recipes (EDIT_TOKEN) must explicitly have null author fields and will not display "by {username}".

### Step 4: Update Recipe Refinement API
**File**: `src/app/api/recipes/[slug]/refine/route.ts`

- **Critical**: When refining/updating a recipe, ALWAYS preserve existing `author_name` and `author_email`
- Fetch existing recipe's author fields before update
- Include `author_name` and `author_email` in the `dbPayload` with values from existing recipe
- This ensures the original author is preserved even if:
  - Recipe is refined by a script (EDIT_TOKEN)
  - Recipe is refined by another user
  - Recipe is refined by the original author
- Author attribution should reflect who created the recipe, not who last edited it

**Phase 2 Testing Checklist**:
- [ ] Create new recipe while logged in → verify `author_name` and `author_email` are saved in database
- [ ] Create new recipe via EDIT_TOKEN → verify `author_name` and `author_email` are `null` in database
- [ ] Update existing recipe (upsert) → verify existing author fields are preserved
- [ ] Refine existing recipe → verify existing author fields are preserved
- [ ] Refine recipe created by User A, edited by User B → verify still shows User A's email
- [ ] Query database directly to verify author fields are set correctly

**Phase 2 Database Verification Queries**:
```sql
-- Check recipes with authors
SELECT slug, name, author_name, author_email FROM recipes WHERE author_name IS NOT NULL LIMIT 5;

-- Check scripted recipes (should have null authors)
SELECT slug, name, author_name, author_email FROM recipes WHERE author_name IS NULL LIMIT 5;
```

---

## Phase 3: Frontend - Display Author Info
**Goal**: Display "by {username}" on recipe pages  
**Testability**: View recipes and verify author attribution displays correctly  
**Can proceed to Phase 4**: ✅ After author attribution displays on recipe pages

### Step 5: Update Recipe Display Component
**File**: `src/components/recipe/description.tsx`

- Add `authorName` prop (string | null)
- Display "by {authorName}" after description text when `authorName` is provided
- Style consistently with description text (smaller, muted color, italic?)
- Place after description paragraph, before tags section

Example structure:
```tsx
{description ? <p className="text-base text-slate-600">{description}</p> : null}
{authorName ? (
  <p className="text-sm text-slate-500 italic">by {authorName}</p>
) : null}
```

### Step 6: Update Recipe Data Fetching
**Files**:
- `src/app/recipes/[slug]/page.tsx` - ensure author fields are selected
- `src/hooks/useRecipe.ts` - check if needs updates to handle author fields
- `src/lib/fetch-recipe-data.ts` - ensure author fields are included in queries

Verify that all recipe queries include `author_name` and `author_email` in SELECT statements.

### Step 7: Handle Existing Recipes
- Existing recipes will have `null` values for `author_name` and `author_email`
- Display component should gracefully handle null values (don't show "by" line)
- This is acceptable behavior - existing recipes simply won't show author attribution

### Step 8: Update Recipe Generation Hook (if needed)
**File**: `src/hooks/useRecipeGeneration.ts`

- When calling `/api/recipes` POST, ensure the authentication token is passed
- No changes needed to payload structure (author info comes from auth context)

**Phase 3 Testing Checklist**:
- [ ] View recipe created by logged-in user → should show "by {username}" after description
- [ ] View existing recipe (no author) → should NOT show "by" line
- [ ] View scripted recipe (null author) → should NOT show "by" line
- [ ] Verify author name displays correctly (full name or email prefix)
- [ ] Verify styling is consistent (smaller, muted, italic)
- [ ] Test on mobile and desktop views
- [ ] Verify no console errors when viewing recipes

**Phase 3 Manual Testing Steps**:
1. Create a recipe while logged in
2. Navigate to recipe page
3. Verify "by {username}" appears after description
4. View an old recipe (without author)
5. Verify no "by" line appears

---

## Phase 4: "My Recipes" Filter
**Goal**: Add "My Recipes" menu item and filter functionality  
**Testability**: Use menu item and verify filtered recipes  
**Complete**: ✅ After "My Recipes" filter works correctly

### Step 9: Add "My Recipes" Menu Item
**File**: `src/components/user-avatar.tsx`

- Add "My Recipes" menu item between user info section and "Sign out" button
- When clicked, navigate to feed with `mine=true` URL parameter
- Should only be visible when user is logged in (already in menu that only shows when logged in)
- When clicked, close the menu

Example:
```tsx
<button
  onClick={() => {
    router.push(`${pathname}?mine=true`);
    setIsMenuOpen(false);
  }}
  className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
>
  My Recipes
</button>
```

**Note**: Need to import `useRouter`, `usePathname` from `next/navigation`

### Step 10: Update Feed Layout for "My Recipes" Filter
**File**: `src/app/feed/layout.tsx`

- Read `mine` parameter from URL: `const isMineActive = searchParams.get("mine") === "true"`
- When `mine=true` is active and user logs out, clear the parameter (similar to favorites)
- Ensure `mine` and `favorites` parameters can coexist in URL, but they filter independently
- Pass `mine` parameter to `usePaginatedRecipes` hook (via options)

### Step 10a: Update usePaginatedRecipes Hook
**File**: `src/hooks/usePaginatedRecipes.ts`

- Add `mine?: boolean` to `UsePaginatedRecipesOptions` type
- Add `mine` parameter to `fetchRecipes` function signature
- Include `mine` in URL params when true: `if (mineToFetch) { params.append("mine", "true"); }`
- Include auth token in headers when `mine` is true (similar to favorites logic)
- Update `loadInitialRecipes` and `loadMore` to pass `mine` option
- Add `mine` to the useEffect dependency array for auto-loading

### Step 10b: Update Feed Page
**File**: `src/app/feed/page.tsx`

- Read `mine` parameter from searchParams: `const mine = searchParams.get("mine") === "true"`
- Pass `mine` option to `usePaginatedRecipes` hook: `usePaginatedRecipes({ tags: activeTags, searchQuery, favorites, mine })`

### Step 11: Update Recipes API for "My Recipes" Filter
**File**: `src/app/api/recipes/route.ts`

In the `GET` handler:
- Read `mine` parameter: `const mineParam = searchParams.get("mine"); const showMine = mineParam === "true"`
- When `showMine` is true:
  - Authenticate the request (require user session, not EDIT_TOKEN)
  - Filter recipes where `author_email` matches authenticated user's email
  - Return 401 if not authenticated
- Apply filter after fetching recipes but before search/tag filtering
- `mine` filter works independently from `favorites` filter (can be combined)

Example filtering logic:
```typescript
// Apply "mine" filter if requested
if (showMine && auth.userEmail) {
  allRecipes = allRecipes.filter((recipe) => 
    recipe.author_email?.toLowerCase() === auth.userEmail?.toLowerCase()
  );
}
```

**Note**: Must authenticate request to get user email for filtering.

**Phase 4 Testing Checklist**:
- [ ] "My Recipes" menu item appears in user dropdown
- [ ] Clicking "My Recipes" navigates to feed with `mine=true` parameter
- [ ] Feed shows only recipes where `author_email` matches current user
- [ ] Logging out while `mine=true` is active clears the parameter
- [ ] Combining `mine=true` and `favorites=true` shows intersection
- [ ] User with no recipes shows empty feed (not error)
- [ ] Scripted recipes (null author_email) don't appear in "My Recipes"
- [ ] Filter works with tag filters and search
- [ ] Authentication required - returns 401 if not logged in

**Phase 4 Manual Testing Steps**:
1. Log in as User A
2. Create a recipe (should have User A as author)
3. Click "My Recipes" in user menu
4. Verify only User A's recipes appear
5. Log out → verify `mine=true` is cleared from URL
6. Log in as User B
7. Click "My Recipes" → verify User B's recipes appear (different from User A)
8. Verify scripted recipes don't appear in "My Recipes"

---

## Full Integration Testing

After all phases are complete, run these integration tests:

### Complete Testing Considerations

### End-to-End Scenarios

1. **New Recipe Creation Flow**:
   - Create recipe while logged in → should save author name and email
   - Verify "by {username}" appears on recipe page
   - Check database to confirm author fields are set

2. **Existing Recipes**:
   - View existing recipes → should not show "by" line (graceful handling)
   - No errors or warnings in console

3. **Recipe Refinement**:
   - Refine existing recipe → should preserve original author info
   - Refine recipe created by User A, edited by User B → should still show "by User A"
   - Refine recipe via script (EDIT_TOKEN) → should preserve original author info (or null if scripted)

4. **Scripted Creation**:
   - Recipe created via EDIT_TOKEN → author fields must be explicitly null
   - Recipe page should not show "by" line (this is intentional for scripted recipes)
   - Verify scripted recipes never display author attribution

5. **Edge Cases**:
   - User with no full_name in metadata → should use email prefix
   - User with no email → should use "User" fallback
   - Empty/null author_name → should not display "by" line

6. **Author Preservation During Edits**:
   - Update recipe via POST (upsert) → should preserve existing author fields
   - Refine recipe → should preserve existing author fields
   - Edit recipe created by User A, update by User B → should still show "by User A"
   - Edit recipe via script → should preserve existing author fields
   - Verify author fields are never overwritten in any update scenario

## Migration Considerations

- Migration adds nullable columns, so it's safe to run on existing database
- No data loss or breaking changes
- Existing recipes will continue to work (just won't show author attribution)

## Additional Requirements

### Scripted Recipes Behavior
- Recipes created via EDIT_TOKEN must have `author_name` and `author_email` set to `null`
- These recipes should never display "by {username}" attribution
- This is intentional - scripted/automated recipes are treated as system-generated content

### Author Field Immutability
- **CRITICAL**: Author fields (`author_name` and `author_email`) are **immutable** after initial creation
- Once a recipe is created with author info (or null), these fields should NEVER be changed
- This applies to ALL update scenarios:
  - Recipe refinement/editing by any user
  - Recipe refinement/editing by scripts (EDIT_TOKEN)
  - Recipe updates via upsert operations
- Implementation pattern:
  1. Before any update, fetch existing recipe's `author_name` and `author_email`
  2. Include these fields in update payload (preserve existing values)
  3. Never set author fields in update payload unless recipe is new
- Rationale: Author attribution should always reflect the original creator, not who last edited the recipe

### My Recipes Feature
- Add "My Recipes" menu item in user dropdown menu
- Filter uses `mine=true` URL parameter (similar to `favorites=true`)
- Filters recipes where `author_email` matches authenticated user's email
- Requires authentication (returns 401 if not logged in)
- Can be combined with other filters (tags, search, favorites)
- Clears automatically when user logs out

## Future Enhancements (Out of Scope)

- Author profile pages
- Filtering recipes by other authors (beyond "My Recipes")
- Editing author information
- Multiple authors per recipe
- Author avatars next to name
- Recipe edit/delete functionality for recipe authors

