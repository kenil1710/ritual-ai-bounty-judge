/**
 * About — a short, plain-language explanation of what this app is and the
 * privacy guarantee it makes. Sits just above the footer.
 */
export function About() {
  return (
    <section
      aria-labelledby="about-heading"
      className="mt-14 border-t border-line pt-8"
    >
      <h2 id="about-heading" className="font-serif text-xl font-medium text-ink">
        About
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        AI Bounty Judge runs on Ritual Chain. Answers stay hidden until judging
        with a commit-reveal flow: you commit a hash first, then reveal the text
        after the deadline. Once the deadline passes, Ritual&apos;s on-chain LLM
        reviews the revealed answers and the owner picks the winner. No one, not
        even the owner, can read a submission before the reveal phase, so earlier
        answers can&apos;t be copied.
      </p>
    </section>
  );
}
