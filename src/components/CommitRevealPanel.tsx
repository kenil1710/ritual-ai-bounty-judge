"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import type { Address, Hex } from "viem";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import {
  generateSalt,
  computeCommitment,
  saveCommitment,
  loadCommitment,
  markRevealed,
  type StoredCommitment,
} from "@/lib/commitReveal";
import { Button, Textarea } from "@/components/ui";

/**
 * CommitRevealPanel
 *
 * Drives the participant side of the two-phase flow:
 *  - SUBMIT phase: type an answer, generate a salt, save it locally, send the
 *    commitment hash on-chain.
 *  - REVEAL phase: read the saved {answer, salt} back, send the reveal tx.
 *
 * The salt is persisted the instant the commitment is made, so the user does
 * not have to copy a hex string. A manual backup copy is also offered.
 */
export function CommitRevealPanel({
  contract,
  bountyId,
  phase,
}: {
  contract: Address;
  bountyId: bigint;
  phase: "submit" | "reveal" | string;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();

  const [answer, setAnswer] = useState("");
  const [stored, setStored] = useState<StoredCommitment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load any locally-saved commitment for this bounty + account. A one-shot
  // read from localStorage (an external store) whenever the identity keys
  // change, so the set-state-in-effect perf rule doesn't meaningfully apply.
  useEffect(() => {
    if (!address) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStored(
      loadCommitment(chainId, contract, bountyId.toString(), address),
    );
  }, [address, chainId, contract, bountyId]);

  if (!address) {
    return <p className="text-sm text-muted">Connect your wallet to take part.</p>;
  }

  async function handleCommit() {
    setError(null);
    if (!answer.trim()) {
      setError("Write an answer first.");
      return;
    }
    try {
      const salt = generateSalt();
      const commitment = computeCommitment({
        answer,
        salt,
        sender: address as Address,
        bountyId,
      });

      // Persist BEFORE sending the tx, so a refresh mid-tx never loses the salt.
      const record: StoredCommitment = {
        bountyId: bountyId.toString(),
        account: address as Address,
        answer,
        salt,
        commitment,
        createdAt: Date.now(),
      };
      saveCommitment(chainId, contract, record);
      setStored(record);

      await writeContractAsync({
        address: contract,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed.");
    }
  }

  async function handleReveal() {
    setError(null);
    if (!stored) {
      setError(
        "No saved commitment found in this browser. Paste your salt manually to reveal.",
      );
      return;
    }
    try {
      await writeContractAsync({
        address: contract,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "revealAnswer",
        args: [bountyId, stored.answer, stored.salt as Hex],
      });
      markRevealed(chainId, contract, bountyId.toString(), address as Address);
      // Reflect the reveal locally so this panel flips to the confirmed state
      // immediately (markRevealed only touches localStorage).
      setStored((prev) => (prev ? { ...prev, revealedAt: Date.now() } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed.");
    }
  }

  function copySalt() {
    if (!stored) return;
    navigator.clipboard.writeText(stored.salt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ---- SUBMIT phase ----
  if (phase === "submit") {
    if (stored) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand">
            ✓ Commitment submitted. Your answer is hidden until the reveal phase.
          </p>
          <button
            onClick={copySalt}
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            {copied ? "Salt copied" : "Back up my salt"}
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={2000}
          placeholder="Your answer (stays hidden, only a hash is submitted)"
          rows={5}
        />
        <Button type="button" onClick={handleCommit} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit hidden commitment"}
        </Button>
        {error && <p className="text-sm text-brick">{error}</p>}
      </div>
    );
  }

  // ---- REVEAL phase ----
  if (phase === "reveal") {
    if (stored?.revealedAt) {
      return (
        <p className="text-sm font-medium text-brand">
          ✓ Revealed. Your answer is now eligible for judging.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {stored ? (
          <p className="text-sm text-muted">
            Ready to reveal your saved answer. The contract will verify it
            matches your commitment.
          </p>
        ) : (
          <p className="text-sm text-[#7a5a12]">
            No saved commitment in this browser. If you committed elsewhere,
            you’ll need that salt to reveal.
          </p>
        )}
        <Button
          type="button"
          onClick={handleReveal}
          disabled={isPending || !stored}
        >
          {isPending ? "Revealing…" : "Reveal my answer"}
        </Button>
        {error && <p className="text-sm text-brick">{error}</p>}
      </div>
    );
  }

  // ---- other phases ----
  return (
    <p className="text-sm text-muted">
      This bounty is not accepting commitments or reveals right now.
    </p>
  );
}
