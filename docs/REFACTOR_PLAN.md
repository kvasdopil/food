# Frontend Refactoring Plan

## Executive Summary

This document consolidates 4 previous refactoring analyses into a single, actionable plan. The goal is to eliminate code duplication, simplify complex logic, and improve maintainability through DRY, KISS, and separation of concerns principles.

**Key Statistics:**
- **Duplicated code patterns:** ~8-10 instances
- **Components > 200 lines:** 2 (`AddRecipeModal`, `FeedCard`)
- **Estimated lines to remove:** ~500-700
- **Expected complexity reduction:** -40% average

---

## Critical Issues Identified

### 🔴 High Priority - Code Duplication

1. **Tag Chip Palette** - Duplicated in 3 files
2. **Infinite Scroll Logic** - Identical in 2 files
3. **Cached Recipes Transformation** - Duplicated in 2 files
4. **Recipe Grid Rendering** - Same JSX in 2 files
5. **Favorite Management** - Two different implementations
6. **Error/Empty States** - Duplicated UI patterns

### 🟡 Medium Priority - Separation of Concerns

7. **Feed Page Complexity** - Too many responsibilities
8. **AddRecipeModal Complexity** - 440+ lines doing everything
9. **Search Query Sync** - Overcomplicated state management
10. **RecipeFeedCard** - Mixed UI and business logic

### 🟢 Low Priority - Code Quality

11. **Type Transformations** - Multiple conversion functions needed
12. **Session Token Fetching** - Duplicated logic
13. **Grid Layout Classes** - Repeated className strings

---

## Implementation Plan

### Phase 1: Foundation - Shared Constants & Utilities

**Goal:** Extract shared constants and simple utilities with zero risk.

#### Step 1.1: Create UI Constants File
- **File:** `src/lib/ui-constants.ts`
- **Actions:**
  1. Create file with `TAG_CHIP_PALETTE` constant
  2. Add `TAG_CHIP_PALETTE_INTERACTIVE` variant (with hover states)
  3. Add `RECIPE_GRID_CLASSES` constant
- **Test:** Verify file exports correctly
- **Estimated Time:** 15 minutes

#### Step 1.2: Replace chipPalette in recipe-feed-card.tsx
- **File:** `src/components/recipe-feed-card.tsx`
- **Actions:**
  1. Import `TAG_CHIP_PALETTE` from `ui-constants`
  2. Remove local `chipPalette` array
  3. Use imported constant
- **Test:** Verify tags render with correct colors
- **Estimated Time:** 10 minutes

#### Step 1.3: Replace chipPalette in recipe-search-bar.tsx
- **File:** `src/components/recipe-search-bar.tsx`
- **Actions:**
  1. Import `TAG_CHIP_PALETTE` from `ui-constants`
  2. Remove local `chipPalette` array
  3. Use imported constant
- **Test:** Verify tags render correctly in search bar
- **Estimated Time:** 10 minutes

#### Step 1.4: Replace chipPalette in recipe/description.tsx
- **File:** `src/components/recipe/description.tsx`
- **Actions:**
  1. Import `TAG_CHIP_PALETTE` from `ui-constants`
  2. Remove local `chipPalette` array
  3. Use imported constant
- **Test:** Verify tags render correctly on recipe detail page
- **Estimated Time:** 10 minutes

#### Step 1.5: Replace grid classes with constant
- **Files:** `src/app/feed/page.tsx`, `src/components/feed-card.tsx`
- **Actions:**
  1. Import `RECIPE_GRID_CLASSES` from `ui-constants`
  2. Replace hardcoded grid className strings
- **Test:** Verify grid layout works correctly
- **Estimated Time:** 10 minutes

**Phase 1 Total:** ~55 minutes

---

### Phase 2: Extract Favorite Management Hook

**Goal:** Unify favorite logic into a single, reusable hook.

#### Step 2.1: Create favorites storage utility
- **File:** `src/lib/favorites-storage.ts`
- **Actions:**
  1. Create `FAVORITES_STORAGE_KEY` constant
  2. Create `getFavoriteStatus(slug: string): boolean`
  3. Create `toggleFavoriteStorage(slug: string): boolean`
  4. Create `getAllFavorites(): string[]`
- **Test:** Unit test storage functions
- **Estimated Time:** 20 minutes

#### Step 2.2: Create useFavorites hook
- **File:** `src/hooks/useFavorites.ts`
- **Actions:**
  1. Create hook that uses favorites storage
  2. Return `{ isFavorite, toggleFavorite }`
  3. Handle localStorage sync
  4. Add TypeScript types
- **Test:** Test hook with React Testing Library
- **Estimated Time:** 30 minutes

#### Step 2.3: Refactor RecipeFeedCard to use hook
- **File:** `src/components/recipe-feed-card.tsx`
- **Actions:**
  1. Import `useFavorites` hook
  2. Replace inline localStorage logic (lines 30-55)
  3. Replace favorite button handler (lines 66-78)
  4. Remove local state management
- **Test:** Verify favorites persist correctly
- **Estimated Time:** 20 minutes

#### Step 2.4: Update FavoriteButton component
- **File:** `src/components/favorite-button.tsx`
- **Actions:**
  1. Add `slug` prop
  2. Use `useFavorites` hook
  3. Make it functional with localStorage
- **Test:** Verify button toggles favorites correctly
- **Estimated Time:** 15 minutes

**Phase 2 Total:** ~85 minutes

---

### Phase 3: Extract Infinite Scroll Hook

**Goal:** Create reusable infinite scroll hook for both window and container scrolling.

#### Step 3.1: Create useInfiniteScroll hook
- **File:** `src/hooks/useInfiniteScroll.ts`
- **Actions:**
  1. Create hook with options:
     - `containerRef?: RefObject<HTMLElement>`
     - `hasMore: boolean`
     - `isLoading: boolean`
     - `onLoadMore: () => void`
     - `threshold?: number` (default: 1000)
     - `throttleMs?: number` (default: 100)
  2. Support both window scroll and container scroll
  3. Implement throttling logic
  4. Handle cleanup properly
- **Test:** Test with both window and container scrolling
- **Estimated Time:** 45 minutes

#### Step 3.2: Refactor feed/page.tsx to use hook
- **File:** `src/app/feed/page.tsx`
- **Actions:**
  1. Import `useInfiniteScroll`
  2. Remove scroll handling code (lines 76-104)
  3. Replace with hook call
  4. Remove scroll event listeners
- **Test:** Verify infinite scroll works on feed page
- **Estimated Time:** 20 minutes

#### Step 3.3: Refactor feed-card.tsx to use hook (if still needed)
- **File:** `src/components/feed-card.tsx`
- **Note:** This file will be removed in Phase 6 (mobile carousel removal)
- **Actions:** Skip if removing carousel, otherwise:
  1. Import `useInfiniteScroll`
  2. Remove scroll handling code (lines 77-105)
  3. Replace with hook call using containerRef
- **Test:** Verify infinite scroll works in container
- **Estimated Time:** 20 minutes

**Phase 3 Total:** ~85 minutes (or ~65 if removing carousel)

---

### Phase 4: Extract Cached Recipes Logic

**Goal:** Centralize cached recipe transformation logic.

#### Step 4.1: Create recipe transformers utility
- **File:** `src/lib/recipe-transformers.ts`
- **Actions:**
  1. Create `partialToListItem(partial: RecipePartialData): RecipeListItem`
  2. Create `convertPartialsToRecipeListItems(partials: RecipePartialData[]): RecipeListItem[]`
  3. Create `mergeCachedWithRecipes(recipes: RecipeListItem[], cached: RecipePartialData[]): RecipeListItem[]`
  4. Add proper TypeScript types
- **Test:** Unit test transformation functions
- **Estimated Time:** 30 minutes

#### Step 4.2: Create useCachedRecipes hook
- **File:** `src/hooks/useCachedRecipes.ts`
- **Actions:**
  1. Create hook that takes `isLoading` and `recipes`
  2. Implement `allCachedRecipes` logic (lines 22-38 from feed/page.tsx)
  3. Implement `cachedRecipesForLoading` logic (lines 40-57 from feed/page.tsx)
  4. Use transformers utility
  5. Return `{ allCachedRecipes, cachedRecipesForLoading, displayRecipes }`
- **Test:** Test hook with different loading states
- **Estimated Time:** 40 minutes

#### Step 4.3: Refactor feed/page.tsx to use hook
- **File:** `src/app/feed/page.tsx`
- **Actions:**
  1. Import `useCachedRecipes`
  2. Remove cached recipes logic (lines 22-57)
  3. Use hook instead
  4. Update references to use hook return values
- **Test:** Verify cached recipes display correctly
- **Estimated Time:** 20 minutes

#### Step 4.4: Refactor feed-card.tsx to use hook (if still needed)
- **File:** `src/components/feed-card.tsx`
- **Note:** This file will be removed in Phase 6
- **Actions:** Skip if removing carousel, otherwise:
  1. Import `useCachedRecipes`
  2. Remove cached recipes logic (lines 31-66)
  3. Use hook instead
- **Test:** Verify cached recipes work in carousel
- **Estimated Time:** 20 minutes

**Phase 4 Total:** ~110 minutes (or ~90 if removing carousel)

---

### Phase 5: Extract Shared Components

**Goal:** Create reusable components for common UI patterns.

#### Step 5.1: Create RecipeGrid component
- **File:** `src/components/recipe-grid.tsx`
- **Actions:**
  1. Extract grid rendering JSX from feed/page.tsx (lines 113-126, 160-173)
  2. Extract from feed-card.tsx (lines 115-128, 164-175)
  3. Accept `recipes: RecipeListItem[]` prop
  4. Use `RECIPE_GRID_CLASSES` constant
  5. Render `RecipeFeedCard` for each recipe
- **Test:** Verify grid renders correctly
- **Estimated Time:** 25 minutes

#### Step 5.2: Create ErrorState component
- **File:** `src/components/error-state.tsx`
- **Actions:**
  1. Extract error display pattern from feed/page.tsx (lines 134-147)
  2. Extract from feed-card.tsx (lines 137-150)
  3. Extract from recipe/recipe.tsx (lines 69-78)
  4. Accept `{ error: string, onRetry?: () => void, className?: string }`
  5. Create consistent error UI
- **Test:** Verify error states display correctly
- **Estimated Time:** 20 minutes

#### Step 5.3: Create FeedStates component
- **File:** `src/components/feed-states.tsx`
- **Actions:**
  1. Create `FeedErrorState` component
  2. Create `FeedEmptyState` component
  3. Create `FeedLoadingMore` component (skeleton loaders)
  4. Extract from feed/page.tsx and feed-card.tsx
- **Test:** Verify all states display correctly
- **Estimated Time:** 30 minutes

#### Step 5.4: Update feed/page.tsx to use new components
- **File:** `src/app/feed/page.tsx`
- **Actions:**
  1. Import `RecipeGrid`, `FeedErrorState`, `FeedEmptyState`, `FeedLoadingMore`
  2. Replace inline JSX with components
  3. Simplify render logic
- **Test:** Verify feed page renders correctly
- **Estimated Time:** 20 minutes

#### Step 5.5: Create TagChip component (optional)
- **File:** `src/components/tag-chip.tsx`
- **Actions:**
  1. Create component with variants: "static" | "clickable" | "removable"
  2. Extract tag rendering from:
     - `recipe-feed-card.tsx` (clickable tags)
     - `recipe-search-bar.tsx` (removable tags)
     - `recipe/description.tsx` (static tags)
  3. Use `TAG_CHIP_PALETTE` constant
  4. Accept `onClick` and `onRemove` handlers
- **Test:** Verify all tag variants work correctly
- **Estimated Time:** 40 minutes

**Phase 5 Total:** ~135 minutes

---

### Phase 6: Remove Mobile Carousel (Cleanup)

**Goal:** Remove mobile carousel wrapper and consolidate feed components.

#### Step 6.1: Verify FeedCard is only used in carousel
- **Actions:**
  1. Search codebase for `FeedCard` imports
  2. Confirm only `mobile-carousel-wrapper.tsx` uses it
  3. Check if carousel wrapper is used anywhere
- **Estimated Time:** 10 minutes

#### Step 6.2: Remove mobile-carousel-wrapper.tsx
- **File:** `src/components/mobile-carousel-wrapper.tsx`
- **Actions:**
  1. Delete file
  2. Remove any imports/references to it
  3. Check layout files for usage
- **Test:** Verify app still works without carousel
- **Estimated Time:** 15 minutes

#### Step 6.3: Remove feed-card.tsx
- **File:** `src/components/feed-card.tsx`
- **Actions:**
  1. Delete file (all logic moved to hooks/components)
  2. Remove any imports
- **Test:** Verify no broken imports
- **Estimated Time:** 10 minutes

**Phase 6 Total:** ~35 minutes

---

### Phase 7: Simplify Feed Page

**Goal:** Refactor feed page to use extracted hooks and components.

#### Step 7.1: Simplify feed/page.tsx structure
- **File:** `src/app/feed/page.tsx`
- **Actions:**
  1. Use `useCachedRecipes` hook
  2. Use `useInfiniteScroll` hook
  3. Use `RecipeGrid` component
  4. Use `FeedErrorState`, `FeedEmptyState`, `FeedLoadingMore`
  5. Reduce file to ~100 lines (composition only)
- **Test:** Verify all feed functionality works
- **Estimated Time:** 40 minutes

#### Step 7.2: Extract feed URL building logic (if needed)
- **File:** `src/lib/feed-utils.ts` (if needed)
- **Actions:**
  1. Extract URL building logic
  2. Create `buildFeedUrlWithTagsAndSearch(tags, query)` function
- **Estimated Time:** 20 minutes

**Phase 7 Total:** ~60 minutes

---

### Phase 8: Refactor AddRecipeModal

**Goal:** Split large modal into smaller, focused components and hooks.

#### Step 8.1: Create useSessionToken hook
- **File:** `src/hooks/useSessionToken.ts`
- **Actions:**
  1. Extract session token fetching logic (lines 130-137, 248-255 from add-recipe-modal.tsx)
  2. Handle loading and error states
  3. Return `{ token, fetchToken, isLoading, error }`
- **Test:** Test hook independently
- **Estimated Time:** 30 minutes

#### Step 8.2: Create useRecipeGeneration hook
- **File:** `src/hooks/useRecipeGeneration.ts`
- **Actions:**
  1. Extract recipe generation API calls
  2. Extract recipe adding API calls
  3. Handle state management
  4. Handle errors
  5. Return generation state and functions
- **Test:** Test hook with mock API calls
- **Estimated Time:** 45 minutes

#### Step 8.3: Create useRecipeImage hook
- **File:** `src/hooks/useRecipeImage.ts`
- **Actions:**
  1. Extract image generation logic
  2. Handle image state
  3. Handle errors
- **Test:** Test hook independently
- **Estimated Time:** 30 minutes

#### Step 8.4: Create useModal hook
- **File:** `src/hooks/useModal.ts`
- **Actions:**
  1. Extract modal lifecycle logic (escape, outside click, body scroll)
  2. Return ref for modal container
  3. Handle `isOpen` and `onClose`
  4. Support options: `closeOnEscape`, `closeOnOutsideClick`, `preventBodyScroll`
- **Test:** Test modal behavior
- **Estimated Time:** 35 minutes

#### Step 8.5: Create RecipeInputForm component
- **File:** `src/components/recipe-input-form.tsx`
- **Actions:**
  1. Extract form UI from add-recipe-modal.tsx
  2. Handle form state
  3. Accept `onSubmit` prop
  4. ~80 lines
- **Test:** Test form rendering and submission
- **Estimated Time:** 30 minutes

#### Step 8.6: Create RecipePreviewCard component
- **File:** `src/components/recipe-preview-card.tsx`
- **Actions:**
  1. Extract preview display from add-recipe-modal.tsx
  2. Display generated recipe
  3. Handle image preview
  4. ~60 lines
- **Test:** Test preview rendering
- **Estimated Time:** 25 minutes

#### Step 8.7: Refactor add-recipe-modal.tsx
- **File:** `src/components/add-recipe-modal.tsx`
- **Actions:**
  1. Use `useModal` hook
  2. Use `useRecipeGeneration` hook
  3. Use `useRecipeImage` hook
  4. Use `useSessionToken` hook
  5. Compose `RecipeInputForm` and `RecipePreviewCard`
  6. Reduce to ~150 lines (modal wrapper only)
- **Test:** Verify all modal functionality works
- **Estimated Time:** 45 minutes

**Phase 8 Total:** ~240 minutes

---

### Phase 9: Simplify Search Query Sync

**Goal:** Simplify complex search query synchronization logic.

#### Step 9.1: Create useSearchQuery hook
- **File:** `src/hooks/useSearchQuery.ts`
- **Actions:**
  1. Extract search query sync logic from feed/layout.tsx (lines 20-70)
  2. Simplify using single source of truth pattern
  3. Handle debouncing
  4. Sync with URL
  5. Return `{ query, setQuery, urlQuery }`
- **Test:** Test search query synchronization
- **Estimated Time:** 45 minutes

#### Step 9.2: Refactor feed/layout.tsx
- **File:** `src/app/feed/layout.tsx`
- **Actions:**
  1. Use `useSearchQuery` hook
  2. Remove complex refs and useEffects
  3. Simplify to ~30 lines
- **Test:** Verify search sync works correctly
- **Estimated Time:** 30 minutes

**Phase 9 Total:** ~75 minutes

---

### Phase 10: Final Cleanup & Organization

**Goal:** Organize hooks and perform final cleanup.

#### Step 10.1: Organize hooks into subdirectories (optional)
- **Structure:**
  ```
  src/hooks/
    data/
      usePaginatedRecipes.ts
      useRecipe.ts
      useCachedRecipes.ts
    ui/
      useInfiniteScroll.ts
      useModal.ts
      useDebouncedSearch.ts
    auth/
      useAuth.ts
      useSessionToken.ts
    features/
      useFavorites.ts
      useTags.ts
      useRecipeGeneration.ts
      useRecipeImage.ts
      useSearchQuery.ts
  ```
- **Actions:**
  1. Create subdirectories
  2. Move hooks to appropriate folders
  3. Update all imports
- **Test:** Verify all imports work
- **Estimated Time:** 45 minutes

#### Step 10.2: Remove unused code
- **Actions:**
  1. Search for unused imports
  2. Remove dead code
  3. Clean up comments
- **Estimated Time:** 30 minutes

#### Step 10.3: Update TypeScript types (if needed)
- **File:** `src/types/recipes.ts` (if exists)
- **Actions:**
  1. Consolidate type definitions
  2. Ensure consistent naming
  3. Add missing types
- **Estimated Time:** 30 minutes

#### Step 10.4: Final testing
- **Actions:**
  1. Test all major user flows:
     - Browse feed
     - Search recipes
     - Filter by tags
     - View recipe details
     - Add favorite
     - Generate new recipe
  2. Check for console errors
  3. Verify localStorage works
  4. Test responsive design
- **Estimated Time:** 60 minutes

**Phase 10 Total:** ~165 minutes

---

## Implementation Summary

### Total Estimated Time
- **Phase 1:** 55 minutes
- **Phase 2:** 85 minutes
- **Phase 3:** 65-85 minutes (depending on carousel removal)
- **Phase 4:** 90-110 minutes (depending on carousel removal)
- **Phase 5:** 135 minutes
- **Phase 6:** 35 minutes
- **Phase 7:** 60 minutes
- **Phase 8:** 240 minutes
- **Phase 9:** 75 minutes
- **Phase 10:** 165 minutes

**Total:** ~845-885 minutes (~14-15 hours)

### Quick Wins (Do First)
1. Phase 1 (UI Constants) - 55 minutes, zero risk
2. Phase 2 (Favorites) - 85 minutes, high impact
3. Phase 3 (Infinite Scroll) - 65 minutes, removes duplication

### High Impact (Do Early)
4. Phase 4 (Cached Recipes) - 90 minutes
5. Phase 5 (Shared Components) - 135 minutes
6. Phase 6 (Remove Carousel) - 35 minutes

### Complex Refactors (Do Later)
7. Phase 7 (Simplify Feed) - 60 minutes
8. Phase 8 (Refactor Modal) - 240 minutes
9. Phase 9 (Search Sync) - 75 minutes
10. Phase 10 (Cleanup) - 165 minutes

---

## Testing Strategy

### After Each Phase
1. **Manual Testing:**
   - Test affected features
   - Check for console errors
   - Verify UI still works

2. **Visual Testing:**
   - Compare before/after visually
   - Check responsive design
   - Verify animations/transitions

3. **Functional Testing:**
   - Test user flows
   - Verify data persistence (localStorage)
   - Check API calls work

### Before Moving to Next Phase
- ✅ All tests pass
- ✅ No console errors
- ✅ No TypeScript errors
- ✅ Manual testing complete
- ✅ Git commit with clear message

---

## Risk Assessment

### Low Risk Phases
- **Phase 1:** Extracting constants (zero risk)
- **Phase 2:** Extracting favorites hook (low risk, isolated)
- **Phase 5:** Creating new components (low risk, additive)

### Medium Risk Phases
- **Phase 3:** Infinite scroll hook (test thoroughly)
- **Phase 4:** Cached recipes hook (test edge cases)
- **Phase 6:** Removing carousel (verify no dependencies)

### High Risk Phases
- **Phase 7:** Simplifying feed page (major refactor)
- **Phase 8:** Refactoring modal (complex component)
- **Phase 9:** Search sync (critical user flow)

### Mitigation Strategies
1. **Incremental Changes:** One phase at a time
2. **Feature Flags:** Consider adding flags for risky changes
3. **Branch Strategy:** Create feature branch for each phase
4. **Rollback Plan:** Keep previous code until verified
5. **Testing:** Comprehensive testing after each phase

---

## Success Metrics

### Code Quality
- ✅ **Lines of Code:** Reduce by ~500-700 lines
- ✅ **Component Complexity:** Average -40% complexity
- ✅ **Duplication:** Eliminate all identified duplicates
- ✅ **Type Safety:** Maintain strict TypeScript

### Maintainability
- ✅ **Single Source of Truth:** Each pattern in one place
- ✅ **Reusability:** 6+ new hooks, 3+ new components
- ✅ **Testability:** Hooks easier to test than components
- ✅ **Documentation:** Clear component/hook purposes

### Performance
- ✅ **No Regressions:** Same or better performance
- ✅ **Bundle Size:** Monitor for increases
- ✅ **Render Performance:** No unnecessary re-renders

---

## Notes

- **Mobile Carousel:** Removed from plan (not needed)
- **Backward Compatibility:** All changes maintain existing functionality
- **TypeScript:** Maintain strict mode throughout
- **Accessibility:** Preserve all ARIA labels and keyboard navigation
- **Performance:** Ensure hooks don't introduce unnecessary re-renders

---

## Questions Resolved

1. ✅ **Mobile carousel:** Removed - not needed
2. ✅ **FavoriteButton:** Will persist to localStorage (consistent behavior)
3. ✅ **FeedCard vs FeedPage:** FeedCard will be removed with carousel
4. ✅ **Modal hook:** Yes, extracting for reusability

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Prioritize phases** based on business needs
3. **Schedule implementation** - can be done incrementally
4. **Start with Phase 1** (quick wins, zero risk)
5. **Test after each phase** before proceeding

---

*Last Updated: Based on 4 comprehensive codebase analyses*

