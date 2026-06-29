"use client";

import { useReadContract } from "wagmi";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import type { JudgeResult } from "@/lib/aiReview";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";

export function SubmissionsList({
  bountyId,
  count,
  judge,
  finalWinner,
}: {
  bountyId: bigint;
  count: number;
  judge?: JudgeResult | null;
  finalWinner?: number;
}) {
  const indices = Array.from({ length: count }, (_, i) => i);

  return (
    <Card>
      <CardHeader
        title="Revealed answers"
        subtitle="Hidden until judging, then shown with the AI's ranking."
        action={<Badge tone="zinc">{count}</Badge>}
      />
      <CardBody className="space-y-3">
        {count === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            No answers revealed yet. Submissions stay hidden until the reveal
            phase.
          </p>
        ) : (
          indices.map((i) => (
            <SubmissionRow
              key={i}
              bountyId={bountyId}
              index={i}
              ranking={judge?.ranking?.find((r) => r.index === i)}
              recommended={judge?.winnerIndex === i}
              isWinner={finalWinner === i}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function SubmissionRow({
  bountyId,
  index,
  ranking,
  recommended,
  isWinner,
}: {
  bountyId: bigint;
  index: number;
  ranking?: { index: number; score: number; reason: string };
  recommended?: boolean;
  isWinner?: boolean;
}) {
  const { data, isLoading } = useReadContract({
    address: contractAddress,
    abi: COMMIT_REVEAL_AI_JUDGE_ABI,
    functionName: "getRevealedAnswer",
    args: [bountyId, BigInt(index)],
    chainId: ritualChain.id,
    query: { enabled: !!contractAddress },
  });

  const submitter = data?.[0];
  const answer = data?.[1];

  return (
    <div
      className={`rounded-xl border p-3 ${
        isWinner
          ? "border-brand/40 bg-brand/[0.06]"
          : recommended
            ? "border-[#2e5a57]/40 bg-[#2e5a57]/[0.06]"
            : "border-line bg-cream/50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">#{index}</span>
          <span className="font-mono text-sm text-ink">
            {submitter ? shortenAddress(submitter) : isLoading ? "loading…" : "-"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {ranking ? <Badge tone="zinc">score {ranking.score}</Badge> : null}
          {isWinner ? (
            <Badge tone="green">Winner</Badge>
          ) : recommended ? (
            <Badge tone="indigo">AI pick</Badge>
          ) : null}
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
        {answer ?? (isLoading ? "" : "-")}
      </p>

      {ranking?.reason ? (
        <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
          <span className="text-muted">AI: </span>
          {ranking.reason}
        </p>
      ) : null}
    </div>
  );
}
