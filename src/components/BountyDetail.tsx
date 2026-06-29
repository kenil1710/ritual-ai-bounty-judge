"use client";

import type { Bounty } from "@/lib/bounty";
import { getBountyPhase, PHASE_META } from "@/lib/bounty";
import { useNow } from "@/hooks/useNow";
import { shortenAddress, formatReward, formatTimestamp, formatRelative } from "@/lib/format";
import { Card, CardHeader, CardBody, Badge, Stat } from "@/components/ui";

export function BountyDetail({
  bountyId,
  bounty,
  isOwner,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
}) {
  const now = useNow();
  const phase = getBountyPhase(bounty, now);
  const meta = PHASE_META[phase];

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted">#{bountyId.toString()}</span>
            <span className="font-serif text-ink">{bounty.title || "Untitled"}</span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {isOwner && <Badge tone="indigo">You own this</Badge>}
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Rubric</div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
            {bounty.rubric || "-"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
          <Stat label="Reward" value={<span className="font-mono">{formatReward(bounty.reward)}</span>} />
          <Stat label="Owner" value={<span className="font-mono">{shortenAddress(bounty.owner)}</span>} />
          <Stat label="Commitments" value={<span className="font-mono">{bounty.commitmentCount.toString()}</span>} />
          <Stat label="Reveals" value={<span className="font-mono">{bounty.revealedCount.toString()}</span>} />
          <Stat
            label="Submit deadline"
            value={
              <span>
                {formatTimestamp(bounty.submitDeadline)}
                <span className="ml-1 text-xs text-muted">
                  ({formatRelative(bounty.submitDeadline)})
                </span>
              </span>
            }
          />
          <Stat
            label="Reveal deadline"
            value={
              <span>
                {formatTimestamp(bounty.revealDeadline)}
                <span className="ml-1 text-xs text-muted">
                  ({formatRelative(bounty.revealDeadline)})
                </span>
              </span>
            }
          />
        </div>

        {bounty.finalized &&
          (bounty.revealedCount === 0n ? (
            <div className="rounded-xl bg-ink/[0.05] px-3 py-2 text-sm text-muted ring-1 ring-inset ring-line">
              Cancelled. No answers were revealed, so the reward was refunded to the
              owner.
            </div>
          ) : (
            <div className="rounded-xl bg-brand/[0.08] px-3 py-2 text-sm text-brand ring-1 ring-inset ring-brand/20">
              Finalized, winner is revealed answer{" "}
              <span className="font-mono font-semibold">#{bounty.winnerIndex.toString()}</span>.
            </div>
          ))}
      </CardBody>
    </Card>
  );
}
