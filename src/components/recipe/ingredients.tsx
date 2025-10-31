type ParsedIngredient = {
  name: string;
  amount?: string;
  notes?: string;
};

type IngredientsProps = {
  ingredients: string;
};

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

export function Ingredients({ ingredients }: IngredientsProps) {
  const parsedIngredients = parseIngredients(ingredients);
  const ingredientLines = parsedIngredients
    ? []
    : ingredients
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

  return (
    <section className="mt-8 space-y-5 px-5 sm:px-10 lg:px-12">
      <h2 className="text-xl font-semibold text-slate-900">Ingredients</h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {parsedIngredients?.map((item) => (
          <li
            key={`${item.name}-${item.amount ?? ""}`}
            className="relative flex flex-col gap-1 rounded-lg pl-2 before:absolute before:top-2.5 before:h-2 before:w-2 before:rounded-full before:bg-emerald-500"
          >
            <div className="pl-6">
              <div className="flex items-baseline gap-2">
                {item.amount ? <span className="text-slate-500">{item.amount}</span> : null}
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
  );
}
