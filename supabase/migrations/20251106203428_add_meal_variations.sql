-- Add variation_of column to recipes table
ALTER TABLE public.recipes
ADD COLUMN variation_of text;

-- Add index for efficient queries on variation_of
CREATE INDEX IF NOT EXISTS recipes_variation_of_idx ON public.recipes (variation_of);

-- Add comment for documentation
COMMENT ON COLUMN public.recipes.variation_of IS 'Normalized base meal name for grouping meal variations (e.g., "Fried Rice", "Tacos")';

