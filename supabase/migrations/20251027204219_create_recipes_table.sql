-- Recipes table with RLS-ready schema.
create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  ingredients text not null,
  instructions text not null,
  image_url text,
  tags text[] not null default array[]::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists recipes_slug_idx on public.recipes (slug);
create index if not exists recipes_tags_gin_idx on public.recipes using gin (tags);

-- Ensure updated_at stays current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

-- Row Level Security
alter table public.recipes enable row level security;

create policy "Allow anonymous read access"
on public.recipes
for select
using (true);
