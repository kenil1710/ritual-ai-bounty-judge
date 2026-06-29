"use client";

import { useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther, parseEther } from "viem";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { RITUAL_WALLET, ritualWalletAbi } from "@/abi/RitualWallet";
import { contractAddress, executorAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canJudge, type Bounty } from "@/lib/bounty";
import { useNow } from "@/hooks/useNow";
import {
  buildJudgeAllLlmInput,
  classifyFeeError,
  JUDGE_ESCROW_ESTIMATE_WEI,
  type JudgeSubmission,
} from "@/lib/ritualLlm";
import { DEFAULT_JUDGE_DEPOSIT, LOCK_DURATION } from "@/lib/ritualWallet";
import { useWriteTx } from "@/hooks/useWriteTx";
import { useRitualWalletStatus } from "@/hooks/useRitualWalletStatus";
import { RitualWalletPanel } from "@/components/RitualWalletPanel";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  TxStatus,
  Notice,
  Spinner,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

export function JudgeAll({
  bountyId,
  bounty,
  isOwner,
  onJudged,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
  onJudged: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ritualChain.id });

  // Preflight the *connected* wallet's RitualWallet funding (not the bounty
  // contract) — judgeAll spends prepaid+locked RITUAL via the LLM precompile.
  const walletStatus = useRitualWalletStatus(address);
  const now = useNow();

  const [gathering, setGathering] = useState(false);
  const [gatherError, setGatherError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(() =>
    formatEther(DEFAULT_JUDGE_DEPOSIT),
  );
  const [depositValidationError, setDepositValidationError] = useState<
    string | null
  >(null);
  // Set when the owner used "Deposit more & retry" so we re-run judging once the
  // top-up confirms (the funds are on-chain by then, so we bypass the stale
  // readiness gate).
  const retryAfterDepositRef = useRef(false);

  const judgeTx = useWriteTx(() => onJudged());
  const depositTx = useWriteTx(() => {
    walletStatus.refetch();
    if (retryAfterDepositRef.current) {
      retryAfterDepositRef.current = false;
      void handleJudge({ bypassReadyCheck: true });
    } else {
      // Clear any stale "insufficient funds" judge error now that we've topped up.
      judgeTx.reset();
    }
  });

  const count = Number(bounty.revealedCount);

  // Gate: owner only, reveal window closed, at least one revealed answer, and
  // not already judged or finalized (mirrors the contract's judgeAll checks).
  if (!isOwner || !canJudge(bounty, now)) {
    return null;
  }

  const feeError = classifyFeeError(judgeTx.error ?? gatherError);
  const fundingProblem = feeError.needsMoreFunds;
  const busy = gathering || judgeTx.isBusy;
  const fundingReady = walletStatus.ready === true;

  async function handleJudge(opts?: { bypassReadyCheck?: boolean }) {
    if (!publicClient || !contractAddress) return;
    if (!opts?.bypassReadyCheck && !walletStatus.ready) return;
    setGatherError(null);
    setGathering(true);
    try {
      // Load every revealed answer for this bounty.
      const submissions: JudgeSubmission[] = [];
      for (let i = 0; i < count; i++) {
        const [submitter, answer] = await publicClient.readContract({
          address: contractAddress,
          abi: COMMIT_REVEAL_AI_JUDGE_ABI,
          functionName: "getRevealedAnswer",
          args: [bountyId, BigInt(i)],
        });
        submissions.push({ index: i, submitter, answer });
      }

      // Build the batch judging prompt and encode the Ritual LLM request.
      const llmInput = buildJudgeAllLlmInput({
        executorAddress,
        title: bounty.title,
        rubric: bounty.rubric,
        submissions,
      });

      setGathering(false);

      // Submit it on-chain. This is where an underfunded RitualWallet reverts.
      await judgeTx.run({
        address: contractAddress,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "judgeAll",
        args: [bountyId, llmInput],
        chainId: ritualChain.id,
      });
    } catch (e) {
      setGathering(false);
      setGatherError(
        (e as { shortMessage?: string; message?: string }).shortMessage ||
          (e as Error).message ||
          "Failed to gather revealed answers.",
      );
    }
  }

  async function depositWith(amountStr: string) {
    setDepositValidationError(null);
    let value: bigint;
    try {
      value = parseEther((amountStr || "").trim());
    } catch {
      setDepositValidationError("Enter a valid RITUAL amount.");
      retryAfterDepositRef.current = false;
      return;
    }
    if (value <= 0n) {
      setDepositValidationError("Amount must be greater than 0.");
      retryAfterDepositRef.current = false;
      return;
    }
    try {
      await depositTx.run({
        address: RITUAL_WALLET,
        abi: ritualWalletAbi,
        functionName: "deposit",
        args: [LOCK_DURATION],
        value,
        chainId: ritualChain.id,
      });
    } catch {
      // The deposit itself failed (e.g. rejected in wallet); don't auto-retry.
      retryAfterDepositRef.current = false;
    }
  }

  function handleDeposit() {
    void depositWith(depositAmount);
  }

  // Top-up suggestion for the recovery button: cover the parsed shortfall plus a
  // little headroom when the error gave amounts, otherwise add a safe default.
  function suggestTopUpWei(): bigint {
    const balance = walletStatus.balance ?? 0n;
    if (feeError.requiredWei && feeError.requiredWei > balance) {
      return feeError.requiredWei - balance + JUDGE_ESCROW_ESTIMATE_WEI / 2n;
    }
    return DEFAULT_JUDGE_DEPOSIT;
  }

  function handleDepositMoreAndRetry() {
    const next = formatEther(suggestTopUpWei());
    setDepositAmount(next);
    retryAfterDepositRef.current = true;
    void depositWith(next);
  }

  return (
    <Card>
      <CardHeader
        title="Judge all answers"
        subtitle="Sends one Ritual LLM request ranking every revealed answer."
      />
      <CardBody className="space-y-3">
        <Notice tone="indigo">
          AI review is advisory. The bounty owner finalizes the winner.
        </Notice>

        <RitualWalletPanel
          status={walletStatus}
          amount={depositAmount}
          onAmountChange={(v) => {
            setDepositAmount(v);
            setDepositValidationError(null);
          }}
          onDeposit={handleDeposit}
          depositTx={depositTx}
          validationError={depositValidationError}
          highlight={fundingProblem}
        />

        {fundingProblem && (
          <Notice tone="red">
            <p className="font-medium">
              AI judging needs more funds than your RitualWallet has.
            </p>
            <p className="mt-1 font-mono text-[11px]">
              need ~
              {formatEther(feeError.requiredWei ?? JUDGE_ESCROW_ESTIMATE_WEI)}{" "}
              RITUAL · have{" "}
              {formatEther(feeError.availableWei ?? walletStatus.balance ?? 0n)}{" "}
              RITUAL
            </p>
            <p className="mt-1">
              The escrow is refunded after settlement, so the extra isn&apos;t
              lost. Add funds and try again.
            </p>
            <Button
              onClick={handleDepositMoreAndRetry}
              disabled={depositTx.isBusy || busy}
              className="mt-2 w-full"
            >
              {depositTx.isBusy
                ? "Depositing…"
                : busy
                  ? "Retrying…"
                  : `Deposit more & retry (${formatEther(
                      suggestTopUpWei(),
                    )} RITUAL)`}
            </Button>
          </Notice>
        )}

        <Button
          onClick={() => handleJudge()}
          disabled={busy || !fundingReady}
          className="w-full"
        >
          {gathering ? (
            <>
              <Spinner /> Gathering {count} revealed answers…
            </>
          ) : judgeTx.isBusy ? (
            "Judging…"
          ) : !fundingReady ? (
            "Fund RitualWallet to judge"
          ) : (
            `Judge all (${count})`
          )}
        </Button>

        {gatherError && !fundingProblem && (
          <Notice tone="red">{gatherError}</Notice>
        )}
        {!fundingProblem && (
          <TxStatus
            state={judgeTx.state}
            error={judgeTx.error}
            hash={judgeTx.hash}
            explorerBase={explorerBase}
          />
        )}
      </CardBody>
    </Card>
  );
}
