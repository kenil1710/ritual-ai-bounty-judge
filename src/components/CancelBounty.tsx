"use client";

import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canCancel, type Bounty } from "@/lib/bounty";
import { formatReward } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  TxStatus,
  Notice,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

export function CancelBounty({
  bountyId,
  bounty,
  isOwner,
  onCancelled,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
  onCancelled: () => void;
}) {
  const now = useNow();
  const tx = useWriteTx(() => onCancelled());

  // Gate: owner only, reveal window closed with zero revealed answers, and not
  // already judged or finalized (mirrors the contract's cancelBounty checks).
  if (!isOwner || !canCancel(bounty, now)) return null;

  async function handleCancel() {
    if (!contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "cancelBounty",
        args: [bountyId],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Cancel bounty and refund"
        subtitle="The reveal phase closed with no revealed answers, so the reward can be returned."
      />
      <CardBody className="space-y-3">
        <Notice tone="amber">
          No answers were revealed before the deadline. There is no one to pay,
          so cancelling refunds the full reward ({formatReward(bounty.reward)})
          to you.
        </Notice>

        <Button
          onClick={handleCancel}
          disabled={tx.isBusy}
          className="w-full"
        >
          {tx.isBusy ? "Cancelling…" : "Cancel bounty and refund reward"}
        </Button>

        <TxStatus
          state={tx.state}
          error={tx.error}
          hash={tx.hash}
          explorerBase={explorerBase}
        />
      </CardBody>
    </Card>
  );
}
