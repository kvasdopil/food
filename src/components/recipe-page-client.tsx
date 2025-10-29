"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment } from "react";

import { FavoriteButton } from "@/components/favorite-button";
import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipePreloadProvider } from "@/components/recipe-preload-provider";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { ShareRecipeButton } from "@/components/share-recipe-button";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { fetchRandomSlug } from "@/lib/random-recipe";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

type ParsedIngredient = {
  name: string;
  amount?: string;
  notes?: string;
};

type RecipePageClientProps = {
  recipe: {
    slug: string;
    name: string;
    description: string;
    ingredients: string;
    instructions: string;
    imageUrl: string | null;
    tags: string[];
  };
};

function renderInstructionWithHighlights(step: string) {
  const nodes: React.ReactNode[] = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(step)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`text-${lastIndex}`}>{step.slice(lastIndex, match.index)}</Fragment>,
      );
    }
    nodes.push(
      <span key={`highlight-${match.index}`} className="font-semibold text-emerald-600">
        {match[1]}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < step.length) {
    nodes.push(<Fragment key={`text-${lastIndex}`}>{step.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

function parseIngredients(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          amount: item.amount ? String(item.amount).trim() : undefined,
          notes: item.notes ? String(item.notes).trim() : undefined,
        }))
        .filter((item) => item.name.length > 0) as ParsedIngredient[];
    }
  } catch {
    // fallback to string parsing below
  }

  return null;
}

function SwipeNavigationHandler({
  currentSlug,
  onNavigateNext,
  onNavigatePrevious,
}: {
  currentSlug: string;
  onNavigateNext: (slug: string) => Promise<void>;
  onNavigatePrevious: () => Promise<void>;
}) {
  useSwipeNavigation({
    currentSlug,
    onNavigateNext,
    onNavigatePrevious,
  });

  return null;
}

export function RecipePageClient({ recipe }: RecipePageClientProps) {
  const router = useRouter();
  const parsedIngredients = parseIngredients(recipe.ingredients);
  const ingredientLines = parsedIngredients
    ? []
    : recipe.ingredients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const instructionSteps = recipe.instructions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step) => step.replace(/^\d+\.\s*/, ""));

  const imageUrl = resolveRecipeImageUrl(recipe.imageUrl);

  const handleNavigateNext = async (slug: string) => {
    router.push(`/recipes/${slug}`);
  };

  const handleNavigatePrevious = async () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const slug = await fetchRandomSlug(recipe.slug);
    router.push(`/recipes/${slug}`);
  };

  return (
    <RecipePreloadProvider currentSlug={recipe.slug}>
      <SwipeNavigationHandler
        currentSlug={recipe.slug}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
      />
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={recipe.slug} />
        <div className="mx-auto flex w-full max-w-5xl flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
          <RecipeSideNav direction="previous" currentSlug={recipe.slug} />
          <article className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600 sm:shadow-2xl sm:shadow-slate-200/70">
            <figure className="relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9] lg:h-[520px]">
              {imageUrl ? (
                <Image
                  src={imageUrl}
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
                <ShareRecipeButton slug={recipe.slug} title={recipe.name} variant="icon" />
                <FavoriteButton />
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-5 pt-16 pb-6">
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
              <h2 className="text-xl font-semibold text-slate-900">Ingredients</h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {parsedIngredients?.map((item) => (
                  <li
                    key={`${item.name}-${item.amount ?? ""}`}
                    className="relative flex flex-col gap-1 rounded-lg  pl-2 before:absolute before:top-2.5 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500"
                  >
                    <div className="pl-6">
                      <div className="flex items-baseline gap-2">
                        {item.amount ? (
                          <span className="text-slate-500">
                            {item.amount}
                          </span>
                        ) : null}
                        <span className="text-slate-800">{item.name}</span>
                      </div>
                      {item.notes ? (
                        <span className="block text-sm text-slate-500">{item.notes}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
                {!parsedIngredients &&
                  ingredientLines.map((item) => (
                    <li
                      key={item}
                      className="relative pl-6 text-base text-slate-700 before:absolute before:top-2.5 before:left-0 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500"
                    >
                      {item}
                    </li>
                  ))}
              </ul>
            </section>

            <section className="mt-8 space-y-5 px-5 pb-12 sm:px-10 lg:px-12">
              <h2 className="text-xl font-semibold text-slate-900">Instructions</h2>
              <ol className="space-y-3">
                {instructionSteps.map((step, index) => (
                  <li
                    key={`${index}-${step}`}
                    className="flex items-start gap-3 text-base text-slate-700"
                  >
                    <span className="mt-0.5 w-5 flex-shrink-0 text-right text-base font-semibold text-amber-500">
                      {index + 1}
                    </span>
                    <span className="flex-1">{renderInstructionWithHighlights(step)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </article>
          <RecipeSideNav direction="next" currentSlug={recipe.slug} />
        </div>
      </main>
    </RecipePreloadProvider>
  );
}
