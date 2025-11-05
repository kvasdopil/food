# User Analytics & Recipe Attribution Guide

This guide explains where to find app usage per logged-in user and which users created which recipes.

## Quick Answer: What UI is Available?

✅ **Vercel Analytics Dashboard** - Yes, there's a UI for viewing app usage:

- Navigate to: Vercel Dashboard → Your Project → **Analytics** tab
- Shows custom events (`api_endpoint_called`) with user information
- Can filter by `user_id` or `user_email` to see per-user activity

✅ **Vercel Logs Dashboard** - Yes, there's a UI for viewing server logs:

- Navigate to: Vercel Dashboard → Your Project → **Logs** tab
- Shows structured JSON logs with user info
- Can search logs by `user_email` or `user_id`

❌ **Recipe Authorship** - No UI in Vercel for this:

- Recipe authorship data is stored in Supabase (not Vercel)
- Use **Supabase Dashboard** → Table Editor → `recipes` table
- Or use the SQL Editor in Supabase to query recipes by author

---

## App Usage Per Logged-In User

### 1. Vercel Analytics Dashboard (Web UI Available ✅)

Your app uses `@vercel/analytics` to track custom events. To view user usage:

1. **Navigate to Vercel Dashboard:**
   - Go to [vercel.com](https://vercel.com)
   - Select your project
   - Click on the **"Analytics"** tab

2. **View Custom Events:**
   - Look for the custom event: `api_endpoint_called`
   - This event includes:
     - `endpoint` - The API endpoint that was called
     - `method` - HTTP method (GET, POST, etc.)
     - `status_code` - Response status code
     - `is_protected` - Whether it was a protected endpoint
     - `user_id` - User ID (if available)
     - `user_email` - User email (hashed/anonymized by Vercel for privacy)

3. **Filter by User:**
   - In the Analytics dashboard UI, you can filter events by `user_id` or `user_email`
   - This shows you which endpoints each user is calling and how frequently
   - The UI provides charts and graphs for visualizing usage patterns

### 2. Vercel Logs Dashboard (Web UI Available ✅)

Server-side logs include detailed user information:

1. **Navigate to Vercel Dashboard:**
   - Go to your project
   - Click on the **"Logs"** tab

2. **View Structured Logs:**
   - Your app logs structured JSON data via `logApiEndpoint()` function
   - Each log entry includes:
     ```json
     {
       "type": "api_endpoint",
       "endpoint": "/api/recipes",
       "method": "GET",
       "status_code": 200,
       "is_protected": true,
       "user_id": "user-uuid",
       "user_email": "user@example.com",
       "timestamp": "2024-01-01T00:00:00.000Z"
     }
     ```

3. **Search Logs in the UI:**
   - Use Vercel's log search bar to filter by `user_id` or `user_email`
   - Example search: `user_email:"user@example.com"`
   - Example search: `"user_id":"abc123"`
   - The UI allows you to filter, search, and export logs
   - This shows all API calls made by a specific user with timestamps

### 3. Query Analytics Data via API (Advanced)

If you need to programmatically access analytics data, you can use Vercel's Analytics API:

- Documentation: https://vercel.com/docs/analytics/api

## Which Users Created Which Recipes

### 1. Supabase Dashboard (Web UI Available ✅)

**Note:** This data is NOT in Vercel - it's in Supabase. You need to use the Supabase dashboard.

Your recipes are stored in Supabase with author attribution:

1. **Navigate to Supabase Dashboard:**
   - Go to [supabase.com](https://supabase.com)
   - Select your project
   - Go to **"Table Editor"** → `recipes` table

2. **View Recipe Authors in the UI:**
   - The `recipes` table has two author columns:
     - `author_name` - Display name of the creator
     - `author_email` - Email of the creator (indexed for fast queries)
   - Recipes created by logged-in users will have these fields populated
   - Recipes created via scripts (EDIT_TOKEN) will have `null` values
   - You can sort/filter columns directly in the Table Editor UI

3. **Query Recipes by Author (SQL Editor UI):**
   - Go to **"SQL Editor"** tab in Supabase
   - Run queries like:

   ```sql
   -- All recipes by a specific user
   SELECT slug, name, author_name, author_email, created_at
   FROM recipes
   WHERE author_email = 'user@example.com'
   ORDER BY created_at DESC;

   -- Count recipes per user
   SELECT
     author_email,
     author_name,
     COUNT(*) as recipe_count
   FROM recipes
   WHERE author_email IS NOT NULL
   GROUP BY author_email, author_name
   ORDER BY recipe_count DESC;

   -- All recipes with authors
   SELECT slug, name, author_name, author_email, created_at
   FROM recipes
   WHERE author_email IS NOT NULL
   ORDER BY created_at DESC;
   ```

### 2. Direct Database Query Script

You can create a simple script to query this data locally:

**Create a file:** `scripts/query-user-recipes.ts`

```typescript
import { supabaseAdmin } from "../src/lib/supabaseAdminClient";

async function queryUserRecipes() {
  if (!supabaseAdmin) {
    console.error("Supabase admin client not configured");
    return;
  }

  // Get all recipes with authors
  const { data: recipes, error } = await supabaseAdmin
    .from("recipes")
    .select("slug, name, author_name, author_email, created_at")
    .not("author_email", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recipes:", error);
    return;
  }

  // Group by user
  const recipesByUser = recipes.reduce(
    (acc, recipe) => {
      const email = recipe.author_email!;
      if (!acc[email]) {
        acc[email] = {
          email,
          name: recipe.author_name || email.split("@")[0],
          recipes: [],
        };
      }
      acc[email].recipes.push({
        slug: recipe.slug,
        name: recipe.name,
        created_at: recipe.created_at,
      });
      return acc;
    },
    {} as Record<
      string,
      {
        email: string;
        name: string;
        recipes: Array<{ slug: string; name: string; created_at: string }>;
      }
    >,
  );

  // Print summary
  console.log("\n=== Recipes by User ===\n");
  Object.values(recipesByUser).forEach((user) => {
    console.log(`${user.name} (${user.email}): ${user.recipes.length} recipes`);
    user.recipes.forEach((recipe) => {
      console.log(`  - ${recipe.name} (${recipe.slug}) - ${recipe.created_at}`);
    });
    console.log();
  });

  // Print statistics
  console.log("\n=== Statistics ===\n");
  console.log(`Total users with recipes: ${Object.keys(recipesByUser).length}`);
  console.log(`Total recipes with authors: ${recipes.length}`);
  const avgRecipes = recipes.length / Object.keys(recipesByUser).length;
  console.log(`Average recipes per user: ${avgRecipes.toFixed(2)}`);
}

queryUserRecipes();
```

Run it with:

```bash
npx tsx scripts/query-user-recipes.ts
```

### 3. Via API Endpoint (Current App Feature)

Your app already supports filtering recipes by author:

- Users can filter their own recipes using the "My Recipes" filter in the UI
- The API endpoint `/api/recipes?tags=mine` filters recipes by the authenticated user's email
- This requires authentication and shows only recipes created by the logged-in user

## Additional User Activity Tracking

### Recipe Likes

User engagement is also tracked via the `recipe_likes` table:

```sql
-- See which users liked which recipes
SELECT
  rl.user_id,
  rl.recipe_slug,
  r.name as recipe_name,
  r.created_at as liked_at
FROM recipe_likes rl
JOIN recipes r ON r.slug = rl.recipe_slug
ORDER BY rl.user_id, r.created_at DESC;
```

### User Activity Summary Query

```sql
-- Comprehensive user activity summary
SELECT
  u.email,
  COUNT(DISTINCT r.slug) as recipes_created,
  COUNT(DISTINCT rl.recipe_slug) as recipes_liked,
  MIN(r.created_at) as first_recipe_date,
  MAX(r.created_at) as last_recipe_date
FROM auth.users u
LEFT JOIN recipes r ON r.author_email = u.email
LEFT JOIN recipe_likes rl ON rl.user_id = u.id::text
GROUP BY u.email
ORDER BY recipes_created DESC;
```

## Notes

- **Privacy**: Vercel Analytics automatically hashes/anonymizes email addresses in custom events for privacy compliance
- **Author Attribution**: Only recipes created by logged-in users (via Supabase auth) have author fields populated. Scripted recipes (using EDIT_TOKEN) have `null` author fields
- **Indexing**: The `author_email` column is indexed (`recipes_author_email_idx`) for fast queries
- **Analytics**: Custom events are tracked client-side via `trackApiEndpoint()` and server-side via `logApiEndpoint()`
