"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import { useBounty } from "@/hooks/useBounty";
import { useNow } from "@/hooks/useNow";
import { contractAddress } from "@/config/contract";
import { isAddressEqual } from "@/lib/format";
import { decodeAiReview } from "@/lib/aiReview";
import { getBountyPhase } from "@/lib/bounty";
import { BountyDetail } from "@/components/BountyDetail";
import { CommitRevealPanel } from "@/components/CommitRevealPanel";
import { JudgeAll } from "@/components/JudgeAll";
import { FinalizeWinner } from "@/components/FinalizeWinner";
import { CancelBounty } from "@/components/CancelBounty";
import { AIReviewDisplay } from "@/components/AIReviewDisplay";
import { SubmissionsList } from "@/components/SubmissionsList";
import { SubmissionStatus } from "@/components/SubmissionStatus";
import { Card, CardHeader, CardBody, Notice, Spinner } from "@/components/ui";

export function BountyView({ bountyId }: { bountyId: bigint }) {
  const { address } = useAccount();
  const { bounty, isLoading, isError, refetch } = useBounty(bountyId);
  const now = useNow();

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading bounty #{bountyId.toString()}…
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !bounty) {
    return (
      <Notice tone="red">
        Couldn&apos;t load bounty #{bountyId.toString()}. Check the id and that the
        contract address / RPC are configured correctly.
      </Notice>
    );
  }

  // An owner of address(0) means the bounty doesn't exist yet.
  if (/^0x0+$/.test(bounty.owner)) {
    return (
      <Notice tone="amber">
        Bounty #{bountyId.toString()} doesn&apos;t exist.
      </Notice>
    );
  }

  const isOwner = isAddressEqual(address, bounty.owner);
  const judge = decodeAiReview(bounty.aiReview)?.parsed ?? null;
  const phase = getBountyPhase(bounty, now);
  const isParticipantPhase = phase === "submit" || phase === "reveal";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left column: details + participant commit/reveal + owner actions */}
      <div className="space-y-4">
        <BountyDetail bountyId={bountyId} bounty={bounty} isOwner={isOwner} />

        {isParticipantPhase && contractAddress && (
          isOwner ? (
            <Notice tone="indigo">
              You created this bounty, so you can&apos;t submit to it. You
              finalize the winner.
            </Notice>
          ) : (
            <Card>
              <CardHeader
                title={
                  phase === "submit" ? "Submit a hidden answer" : "Reveal your answer"
                }
                subtitle={
                  phase === "submit"
                    ? "Only a commitment hash is sent now. Your answer stays private until the reveal phase."
                    : "Reveal your committed answer so it becomes eligible for judging."
                }
              />
              <CardBody>
                <CommitRevealPanel
                  contract={contractAddress}
                  bountyId={bountyId}
                  phase={phase}
                />
              </CardBody>
            </Card>
          )
        )}

        <JudgeAll
          bountyId={bountyId}
          bounty={bounty}
          isOwner={isOwner}
          onJudged={reload}
        />
        <FinalizeWinner
          bountyId={bountyId}
          bounty={bounty}
          isOwner={isOwner}
          onFinalized={reload}
        />
        <CancelBounty
          bountyId={bountyId}
          bounty={bounty}
          isOwner={isOwner}
          onCancelled={reload}
        />
      </div>

      {/* Right column: live submission status, then (post-judging) AI review +
          revealed answers. */}
      <div className="space-y-4">
        <SubmissionStatus
          bountyId={bountyId}
          phase={phase}
          commitmentCount={bounty.commitmentCount}
          revealedCount={bounty.revealedCount}
          onActivity={reload}
        />
        {bounty.judged && <AIReviewDisplay aiReview={bounty.aiReview} />}
        {/* Answers + submitter addresses appear only AFTER judging; until then
            SubmissionStatus shows privacy-preserving counts only. */}
        {bounty.judged && (
          <SubmissionsList
            bountyId={bountyId}
            count={Number(bounty.revealedCount)}
            judge={judge}
            finalWinner={
              bounty.finalized ? Number(bounty.winnerIndex) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
