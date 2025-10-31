import { Fragment } from "react";

type InstructionsProps = {
  instructions: string;
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

export function Instructions({ instructions }: InstructionsProps) {
  const instructionSteps = instructions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step) => step.replace(/^\d+\.\s*/, ""));

  return (
    <section className="mt-8 space-y-5 px-5 pb-12 sm:px-10 lg:px-12">
      <h2 className="text-xl font-semibold text-slate-900">Instructions</h2>
      <ol className="space-y-3">
        {instructionSteps.map((step, index) => (
          <li key={`${index}-${step}`} className="flex items-start gap-3 text-base text-slate-700">
            <span className="mt-0.5 w-5 flex-shrink-0 text-right text-base font-semibold text-amber-500">
              {index + 1}
            </span>
            <span className="flex-1">{renderInstructionWithHighlights(step)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
