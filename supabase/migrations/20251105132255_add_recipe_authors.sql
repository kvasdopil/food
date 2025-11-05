-- Add author fields to recipes table
ALTER TABLE public.recipes
ADD COLUMN author_name text,
ADD COLUMN author_email text;

-- Add index on author_email for filtering queries
CREATE INDEX IF NOT EXISTS recipes_author_email_idx ON public.recipes (author_email);

