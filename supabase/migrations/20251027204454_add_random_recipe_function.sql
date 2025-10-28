create or replace function public.get_random_recipe()
returns setof public.recipes
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.recipes
  order by random()
  limit 1;
$$;

grant execute on function public.get_random_recipe() to anon, authenticated;
