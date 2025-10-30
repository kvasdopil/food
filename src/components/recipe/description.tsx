const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

type DescriptionProps = {
  description: string | null;
  tags: string[];
};

export function Description({ description, tags }: DescriptionProps) {
  if (!description && tags.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6 px-5 pt-8 sm:px-8">
      {description ? (
        <p className="text-base text-slate-600">{description}</p>
      ) : null}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
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
  );
}
