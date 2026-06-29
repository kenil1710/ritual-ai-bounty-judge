"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { contractAddress, isContractConfigured } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Textarea,
  Button,
  TxStatus,
  Notice,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/** datetime-local value for `now + minutes`, formatted YYYY-MM-DDTHH:mm (local). */
function defaultDeadline(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CreateBountyForm({ onCreated }: { onCreated?: (bountyId: bigint) => void }) {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [submitDeadline, setSubmitDeadline] = useState(() => defaultDeadline(60));
  const [revealDeadline, setRevealDeadline] = useState(() => defaultDeadline(120));
  const [reward, setReward] = useState("");
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  // Once confirmed, pull the new bountyId out of the BountyCreated event log.
  const tx = useWriteTx((receipt) => {
    try {
      const logs = parseEventLogs({
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        eventName: "BountyCreated",
        logs: receipt.logs,
      });
      const id = logs[0]?.args?.bountyId;
      if (id !== undefined) {
        setCreatedId(id);
        onCreated?.(id);
      }
    } catch {
      /* couldn't decode — not fatal */
    }
  });

  // Pure, render-safe validation (no clock reads here — see handleSubmit).
  const validation = useMemo(() => {
    if (!title.trim()) return "Title is required.";
    if (!rubric.trim()) return "Rubric is required.";
    if (!submitDeadline) return "Pick a submit deadline.";
    if (!revealDeadline) return "Pick a reveal deadline.";
    const submitTs = new Date(submitDeadline).getTime();
    const revealTs = new Date(revealDeadline).getTime();
    if (!Number.isFinite(submitTs)) return "Invalid submit deadline.";
    if (!Number.isFinite(revealTs)) return "Invalid reveal deadline.";
    if (revealTs <= submitTs) return "Reveal deadline must be after the submit deadline.";
    if (reward !== "") {
      try {
        parseEther(reward);
      } catch {
        return "Reward must be a valid number.";
      }
    }
    return null;
  }, [title, rubric, submitDeadline, revealDeadline, reward]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation || !contractAddress) return;

    const submitMs = new Date(submitDeadline).getTime();
    const revealMs = new Date(revealDeadline).getTime();
    // Clock reads belong in the event handler, not render.
    if (submitMs <= Date.now()) {
      window.alert("Submit deadline must be in the future.");
      return;
    }
    if (revealMs <= submitMs) {
      window.alert("Reveal deadline must be after the submit deadline.");
      return;
    }

    // Ritual Chain's block.timestamp is in MILLISECONDS (~350ms blocks), so
    // deadlines go on chain as epoch ms — NOT Unix seconds. Dividing by 1000
    // here is what caused every "submit deadline in past" revert: a seconds
    // value (~1.78e9) is always far below the chain's ms clock (~1.78e12).
    // getTime() already returns integer ms, so no flooring is needed.
    const submitTs = BigInt(submitMs);
    const revealTs = BigInt(revealMs);
    const value = reward.trim() === "" ? 0n : parseEther(reward.trim());
    setCreatedId(null);

    try {
      await tx.run({
        address: contractAddress,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "createBounty",
        args: [title.trim(), rubric.trim(), submitTs, revealTs],
        value,
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Create a bounty"
        subtitle="Fund a reward, then set a submit (commit) and a reveal deadline."
      />
      <CardBody>
        {!isContractConfigured && (
          <Notice tone="amber">
            Set <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your{" "}
            <code className="font-mono">.env.local</code> to enable transactions.
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best gas-optimization writeup"
              maxLength={200}
            />
          </Field>

          <Field label="Rubric" hint="How submissions are scored. The AI judges only against this.">
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={4}
              placeholder="e.g. correctness 70%, clarity 30%"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Submit deadline" hint="Commitments accepted until here.">
              <Input
                type="datetime-local"
                value={submitDeadline}
                onChange={(e) => setSubmitDeadline(e.target.value)}
              />
            </Field>
            <Field label="Reveal deadline" hint="Reveals accepted after submit, until here.">
              <Input
                type="datetime-local"
                value={revealDeadline}
                onChange={(e) => setRevealDeadline(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Reward (RITUAL)" hint="Locked in the contract on create.">
            <Input
              type="number"
              min="0"
              step="any"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="1.0"
            />
          </Field>

          {validation && (title || rubric || reward) ? (
            <p className="text-xs text-brick">{validation}</p>
          ) : null}

          <Button
            type="submit"
            disabled={!isConnected || !isContractConfigured || !!validation || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Creating…" : "Create bounty"}
          </Button>

          {!isConnected && (
            <p className="text-xs text-muted">Connect your wallet to create a bounty.</p>
          )}

          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />

          {createdId !== null && (
            <Notice tone="green">
              Bounty created with id{" "}
              <span className="font-mono font-semibold">#{createdId.toString()}</span>. Loaded
              below.
            </Notice>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
