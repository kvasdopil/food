import { FavoriteButton } from "@/components/favorite-button";
import { TAG_CHIP_PALETTE } from "@/lib/ui-constants";

type DescriptionProps = {
  slug: string;
  description: string | null;
  tags: string[];
};

export function Description({ slug, description, tags }: DescriptionProps) {
  if (!description && tags.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6 px-5 pt-8 sm:px-8">
      {description ? <p className="text-base text-slate-600">{description}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <FavoriteButton slug={slug} />
        {tags.map((tag, index) => (
          <span
            key={tag}
            className={`rounded-full px-3 py-1 text-sm font-medium ${TAG_CHIP_PALETTE[index % TAG_CHIP_PALETTE.length]}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
