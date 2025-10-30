import { Description } from "./description";
import { RecipeImage } from "./image";
import { Ingredients } from "./ingredients";
import { Instructions } from "./instructions";

export type RecipeContentProps = {
  name: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  tags: string[];
  slug: string;
};

export function RecipeContent({
  name,
  description,
  ingredients,
  instructions,
  imageUrl,
  tags,
  slug,
}: RecipeContentProps) {
  return (
    <article className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600 sm:shadow-2xl sm:shadow-slate-200/70">
      <RecipeImage name={name} imageUrl={imageUrl} slug={slug} />
      <Description description={description} tags={tags} />
      <Ingredients ingredients={ingredients} />
      <Instructions instructions={instructions} />
    </article>
  );
}
