export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-slate-100 px-6 text-slate-900 dark:from-slate-900 dark:via-slate-950 dark:to-neutral-900 dark:text-slate-100">
      <section className="flex max-w-xl flex-col items-center gap-4 text-center">
        <span className="rounded-full bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
          Next.js + Tailwind
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Hello, world!</h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Your Next.js app is ready to build. Start by editing{" "}
          <code className="rounded bg-slate-900/5 px-2 py-1 font-mono text-base dark:bg-slate-100/10">
            src/app/page.tsx
          </code>{" "}
          and save to see updates instantly.
        </p>
      </section>
    </main>
  );
}
