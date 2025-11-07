-- Recipe likes table for storing user favorites
create table if not exists public.recipe_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_slug text not null references public.recipes(slug) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id, recipe_slug)
);

-- Indexes for efficient querying
create index if not exists recipe_likes_user_id_idx on public.recipe_likes (user_id);
create index if not exists recipe_likes_recipe_slug_idx on public.recipe_likes (recipe_slug);
create index if not exists recipe_likes_user_recipe_idx on public.recipe_likes (user_id, recipe_slug);

-- Row Level Security
alter table public.recipe_likes enable row level security;

-- Users can only see their own likes
create policy "Users can view their own likes"
on public.recipe_likes
for select
using (auth.uid() = user_id);

-- Users can only insert their own likes
create policy "Users can insert their own likes"
on public.recipe_likes
for insert
with check (auth.uid() = user_id);

-- Users can only delete their own likes
create policy "Users can delete their own likes"
on public.recipe_likes
for delete
using (auth.uid() = user_id);




