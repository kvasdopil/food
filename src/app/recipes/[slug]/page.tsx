import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

import { FavoriteButton } from "@/components/favorite-button";
import { KeyboardNav } from "@/components/keyboard-nav";
import { ShareRecipeButton } from "@/components/share-recipe-button";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/supabase";

type Recipe = Tables<"recipes">;

type RecipePageProps = {
  params: {
    slug: string;
  };
};

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

async function fetchRecipeBySlug(slug: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recipe:", error);
    return null;
  }

  return data satisfies Recipe | null;
}

export async function generateMetadata({
  params,
}: RecipePageProps): Promise<Metadata> {
  const recipe = await fetchRecipeBySlug(params.slug);

  if (!recipe) {
    return {
      title: "Recipe not found",
    };
  }

  return {
    title: `${recipe.name} | Recipe Thing`,
    description: recipe.description ?? undefined,
    openGraph: {
      title: recipe.name,
      description: recipe.description ?? undefined,
      images: recipe.image_url ? [{ url: recipe.image_url }] : undefined,
    },
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const recipe = await fetchRecipeBySlug(params.slug);

  if (!recipe) {
    notFound();
  }

  const ingredientLines = recipe.ingredients
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const instructionSteps = recipe.instructions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step) => step.replace(/^\d+\.\s*/, ""));

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900">
      <KeyboardNav currentSlug={recipe.slug} />
      <div className="mx-auto flex w-full max-w-5xl flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
        <RecipeSideNav direction="previous" icon={FiArrowLeft} currentSlug={recipe.slug} />
        <article className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600 sm:shadow-2xl sm:shadow-slate-200/70">
          <figure className="relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9] lg:h-[520px]">
            {recipe.image_url ? (
              <Image
                src={recipe.image_url}
                alt={recipe.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-slate-100 to-slate-300" />
            )}

            <div className="absolute top-4 right-4 flex items-center gap-3">
              <ShareRecipeButton
                slug={recipe.slug}
                title={recipe.name}
                variant="icon"
              />
              <FavoriteButton />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-5 pb-6 pt-16">
              <h1 className="text-3xl font-semibold text-white drop-shadow-sm md:text-4xl">
                {recipe.name}
              </h1>
            </div>
          </figure>

          <section className="space-y-6 px-5 pt-8 sm:px-8">
            {recipe.description ? (
              <p className="text-base text-slate-600">{recipe.description}</p>
            ) : null}

            {recipe.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recipe.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${chipPalette[index % chipPalette.length]}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-8 space-y-5 px-5 sm:px-10 lg:px-12">
            <h2 className="text-xl font-semibold text-slate-900">
              Ingredients
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
              {ingredientLines.map((item) => (
                <li
                  key={item}
                  className="relative pl-6 text-base text-slate-700 before:absolute before:left-0 before:top-2.5 before:h-2 before:w-2 before:rounded-full before:bg-amber-500"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8 space-y-5 px-5 pb-12 sm:px-10 lg:px-12">
            <h2 className="text-xl font-semibold text-slate-900">
              Instructions
            </h2>
            <ol className="space-y-3">
              {instructionSteps.map((step, index) => (
                <li
                  key={`${index}-${step}`}
                  className="flex items-start gap-3 text-base text-slate-700"
                >
                  <span className="mt-0.5 w-5 flex-shrink-0 text-right text-base font-semibold text-amber-500">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </article>
        <RecipeSideNav direction="next" icon={FiArrowRight} currentSlug={recipe.slug} />
      </div>
    </main>
  );
}

