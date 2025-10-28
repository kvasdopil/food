create extension if not exists unaccent;

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '(^-|-$)',
    '',
    'g'
  );
$$;

create or replace function public.generate_recipe_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    new.slug := public.slugify(new.slug);
    return new;
  end if;

  base_slug := public.slugify(new.name);

  if base_slug = '' then
    base_slug := encode(gen_random_bytes(6), 'hex');
  end if;

  candidate := base_slug;

  while exists (
    select 1
    from public.recipes r
    where r.slug = candidate
      and (tg_op = 'INSERT' or r.id <> new.id)
  ) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix::text;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists recipes_generate_slug on public.recipes;
create trigger recipes_generate_slug
before insert or update of name, slug
on public.recipes
for each row
execute function public.generate_recipe_slug();

update public.recipes
set slug = null
where slug is null or slug = '';
