"use client";

import { useCallback } from "react";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import type { BountyPhase } from "@/lib/bounty";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";

/**
 * SubmissionStatus — privacy-first participation panel.
 *
 * WHY we show ONLY counts (plus the connected wallet's OWN status) while a
 * bounty is live: the entire point of the commit-reveal design is that nobody
 * can read, copy, or even size up a rival's answer while the competition is
 * still open. Surfacing answer content — or even the *list of who* has
 * submitted — during the submit and reveal phases would let a latecomer game
 * the race, which is exactly the unfairness this app exists to prevent. So
 * while the bounty is live we expose nothing but aggregate counts and the
 * viewer's own state. Answers and submitter addresses stay hidden until the
 * owner has judged; after that the race is over and it is finally safe to show
 * them (rendered by <SubmissionsList />).
 */
export function SubmissionStatus({
  bountyId,
  phase,
  commitmentCount,
  revealedCount,
  onActivity,
}: {
  bountyId: bigint;
  phase: BountyPhase;
  commitmentCount: bigint;
  revealedCount: bigint;
  /** Bubble a refetch up to the parent so the aggregate counts update live. */
  onActivity?: () => void;
}) {
  const { address } = useAccount();

  // The connected wallet's OWN commitment status — 0=None, 1=Committed,
  // 2=Revealed. We read only our own status, never anyone else's, so the panel
  // can never leak who has entered.
  const { data: statusRaw, refetch: refetchStatus } = useReadContract({
    address: contractAddress,
    abi: COMMIT_REVEAL_AI_JUDGE_ABI,
    functionName: "getCommitmentStatus",
    args: address ? [bountyId, address] : undefined,
    chainId: ritualChain.id,
    query: { enabled: !!contractAddress && !!address },
  });
  const myStatus = statusRaw === undefined ? null : Number(statusRaw);

  // Live counts: whenever anyone commits or reveals for THIS bounty, re-pull our
  // own status and ask the parent to refetch getBounty (which owns the aggregate
  // counts). Stable identity so the watchers don't re-subscribe each render.
  const refresh = useCallback(() => {
    void refetchStatus();
    onActivity?.();
  }, [refetchStatus, onActivity]);

  useWatchContractEvent({
    address: contractAddress,
    abi: COMMIT_REVEAL_AI_JUDGE_ABI,
    eventName: "CommitmentSubmitted",
    args: { bountyId },
    chainId: ritualChain.id,
    enabled: !!contractAddress,
    onLogs: refresh,
  });
  useWatchContractEvent({
    address: contractAddress,
    abi: COMMIT_REVEAL_AI_JUDGE_ABI,
    eventName: "AnswerRevealed",
    args: { bountyId },
    chainId: ritualChain.id,
    enabled: !!contractAddress,
    onLogs: refresh,
  });

  const committed = Number(commitmentCount);
  const revealed = Number(revealedCount);
  const answersPublic = phase === "judged" || phase === "finalized";

  return (
    <Card>
      <CardHeader
        title="Submissions"
        subtitle={
          answersPublic
            ? "Judging is complete. Revealed answers are now public."
            : "Answers stay hidden until the owner judges. Only counts and your own status are shown."
        }
        action={
          <Badge
            tone={phase === "submit" ? "green" : phase === "reveal" ? "amber" : "zinc"}
          >
            {phase === "submit"
              ? `${committed} committed`
              : `${revealed}/${committed} revealed`}
          </Badge>
        }
      />
      <CardBody className="space-y-3">
        {/* Content-free aggregate count — the only participation data exposed
            while the bounty is live. */}
        {phase === "submit" ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">{committed}</span>{" "}
            {committed === 1 ? "commitment" : "commitments"} submitted
          </p>
        ) : (
          <p className="text-sm text-ink">
            <span className="font-semibold">{revealed}</span> of{" "}
            <span className="font-semibold">{committed}</span> revealed
          </p>
        )}

        <OwnStatus phase={phase} status={myStatus} connected={!!address} />

        {!answersPublic && revealed === 0 && (
          <p className="text-xs leading-relaxed text-muted">
            No answers revealed yet. Submissions stay hidden until the reveal
            phase.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** Renders ONLY the connected wallet's own state — never anyone else's. */
function OwnStatus({
  phase,
  status,
  connected,
}: {
  phase: BountyPhase;
  status: number | null;
  connected: boolean;
}) {
  if (!connected) {
    return (
      <p className="text-xs text-muted">Connect your wallet to see your status.</p>
    );
  }
  if (status === null) return null; // still loading

  // 2 = Revealed
  if (status === 2) {
    return <Badge tone="green">✓ You&apos;ve revealed</Badge>;
  }
  // 1 = Committed
  if (status === 1) {
    if (phase === "submit") return <Badge tone="green">✓ You&apos;ve committed</Badge>;
    if (phase === "reveal")
      return <Badge tone="amber">You&apos;ve committed, reveal pending</Badge>;
    return <Badge tone="zinc">You committed (not revealed)</Badge>;
  }
  // 0 = None — only worth nudging while the user can still act.
  if (phase === "submit" || phase === "reveal") {
    return (
      <p className="text-xs text-muted">You haven&apos;t entered this bounty yet.</p>
    );
  }
  return null;
}
