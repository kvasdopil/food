"use client";

import { FavoriteButton } from "@/components/favorite-button";
import { TagChip } from "@/components/tag-chip";
import { buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";

type DescriptionProps = {
  slug: string;
  description: string | null;
  tags: string[];
  authorName?: string | null;
};

export function Description({ slug, description, tags, authorName }: DescriptionProps) {
  if (!description && tags.length === 0 && !authorName) {
    return null;
  }

  return (
    <section className="space-y-6 px-5 pt-8 sm:px-8">
      {description ? <p className="text-base text-slate-600">{description}</p> : null}
      {authorName ? <p className="text-sm text-slate-500 italic">by {authorName}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <FavoriteButton slug={slug} />
        {tags.map((tag, index) => {
          const href = buildFeedUrlWithTagsAndSearch([tag.toLowerCase()]);
          return <TagChip key={tag} tag={tag} variant="link" href={href} index={index} />;
        })}
      </div>
    </section>
  );
}
