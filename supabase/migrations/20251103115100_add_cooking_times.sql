-- Add prep time and cooking time columns to recipes table
alter table public.recipes
  add column if not exists prep_time_minutes integer,
  add column if not exists cook_time_minutes integer;

-- Add comments for documentation
comment on column public.recipes.prep_time_minutes is 'Preparation time in minutes';
comment on column public.recipes.cook_time_minutes is 'Cooking time in minutes';

