import type { Address } from "viem";

/** Parsed shape of the `getBounty` BountyView struct. */
export type Bounty = {
  owner: Address;
  title: string;
  rubric: string;
  reward: bigint;
  submitDeadline: bigint;
  revealDeadline: bigint;
  judged: boolean;
  finalized: boolean;
  commitmentCount: bigint;
  revealedCount: bigint;
  winnerIndex: bigint;
  aiReview: `0x${string}`;
};

/**
 * Raw `getBounty` return value. The commit-reveal contract returns a single
 * `BountyView` struct, so viem decodes it into a *named object* — not the
 * positional tuple the old flat-return contract produced.
 */
export type RawBountyView = {
  owner: Address;
  title: string;
  rubric: string;
  reward: bigint;
  submitDeadline: bigint;
  revealDeadline: bigint;
  judged: boolean;
  finalized: boolean;
  commitmentCount: bigint;
  revealedCount: bigint;
  winnerIndex: bigint;
  aiReview: `0x${string}`;
};

/** Normalise the decoded BountyView struct into our Bounty type. */
export function parseBounty(raw: RawBountyView): Bounty {
  return {
    owner: raw.owner,
    title: raw.title,
    rubric: raw.rubric,
    reward: raw.reward,
    submitDeadline: raw.submitDeadline,
    revealDeadline: raw.revealDeadline,
    judged: raw.judged,
    finalized: raw.finalized,
    commitmentCount: raw.commitmentCount,
    revealedCount: raw.revealedCount,
    winnerIndex: raw.winnerIndex,
    aiReview: raw.aiReview,
  };
}

/**
 * Lifecycle phase of a bounty. Mirrors the contract's `getPhase` view exactly,
 * but computed client-side so it updates live as deadlines pass (driven by
 * `useNow`) without an extra contract read per poll.
 */
export type BountyPhase =
  | "submit"
  | "reveal"
  | "awaiting-judging"
  | "judged"
  | "finalized";

// Times are epoch MILLISECONDS: Ritual Chain's block.timestamp is in ms, so the
// contract's deadlines are stored in ms and `now` must be Date.now() (also ms).
export function getBountyPhase(
  b: Bounty,
  nowMs = Date.now(),
): BountyPhase {
  if (b.finalized) return "finalized";
  if (b.judged) return "judged";
  if (nowMs < Number(b.submitDeadline)) return "submit";
  if (nowMs < Number(b.revealDeadline)) return "reveal";
  return "awaiting-judging";
}

export const PHASE_META: Record<
  BountyPhase,
  { label: string; tone: "green" | "amber" | "indigo" | "zinc" | "red" }
> = {
  submit: { label: "Submit (commit)", tone: "green" },
  reveal: { label: "Reveal", tone: "amber" },
  "awaiting-judging": { label: "Awaiting judging", tone: "indigo" },
  judged: { label: "Judged", tone: "indigo" },
  finalized: { label: "Finalized", tone: "zinc" },
};

/** Participants may submit a hidden commitment only during the submit phase. */
export function canCommit(b: Bounty, nowMs = Date.now()): boolean {
  return getBountyPhase(b, nowMs) === "submit";
}

/** Participants may reveal a committed answer only during the reveal phase. */
export function canReveal(b: Bounty, nowMs = Date.now()): boolean {
  return getBountyPhase(b, nowMs) === "reveal";
}

/**
 * The owner may judge once the reveal window has closed, there is at least one
 * revealed answer, and it hasn't been judged or finalized yet. Matches the
 * contract's `judgeAll` requirements.
 */
export function canJudge(b: Bounty, nowMs = Date.now()): boolean {
  return (
    !b.judged &&
    !b.finalized &&
    nowMs >= Number(b.revealDeadline) &&
    b.revealedCount > 0n
  );
}

/**
 * The owner may cancel and refund only after the reveal window has closed with
 * zero revealed answers, and only while the bounty is neither judged nor
 * finalized. Without revealed answers there is no one to pay, so the reward
 * would otherwise be locked forever. Matches the contract's `cancelBounty`
 * requirements.
 */
export function canCancel(b: Bounty, nowMs = Date.now()): boolean {
  return (
    !b.judged &&
    !b.finalized &&
    nowMs >= Number(b.revealDeadline) &&
    b.revealedCount === 0n
  );
}
