/**
 * "How it works" — a compact, self-explaining walkthrough of the commit →
 * reveal → judge → finalize lifecycle. Purely presentational; uses the shared
 * cream/serif design tokens.
 */

const STEPS = [
  {
    n: 1,
    title: "Commit",
    text: "Submit a hidden answer. Only a hash goes on-chain, so no one can read or copy it.",
  },
  {
    n: 2,
    title: "Reveal",
    text: "After the deadline, reveal your answer. The contract checks it matches your commitment.",
  },
  {
    n: 3,
    title: "AI judges",
    text: "Ritual's on-chain LLM reviews every revealed answer in one batch.",
  },
  {
    n: 4,
    title: "Owner finalizes",
    text: "The owner picks the winner and the reward is paid out.",
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mb-12">
      <h2
        id="how-it-works-heading"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        How it works
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="rounded-card border border-line bg-surface p-4 shadow-sm shadow-black/[0.03]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 font-mono text-sm font-medium text-brand">
              {s.n}
            </span>
            <h3 className="mt-3 font-serif text-base font-medium text-ink">
              {s.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
