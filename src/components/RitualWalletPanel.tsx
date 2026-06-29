"use client";

import { formatEther, parseEther } from "viem";
import {
  DEFAULT_JUDGE_DEPOSIT,
  LOCK_DURATION,
  type RitualWalletStatus,
} from "@/lib/ritualWallet";
import { JUDGE_ESCROW_ESTIMATE_WEI } from "@/lib/ritualLlm";
import { ritualChain } from "@/config/wagmi";
import type { WriteTx } from "@/hooks/useWriteTx";
import {
  Badge,
  Button,
  Field,
  Input,
  Notice,
  Spinner,
  TxStatus,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

type Status = Partial<RitualWalletStatus> & {
  isLoading: boolean;
  hasData: boolean;
};

/**
 * RitualWallet funding preflight shown above "Judge all". The deposit amount is
 * a controlled field (owner-settable, pre-filled with a safe default) because
 * judging fees vary with the model and the worst-case escrow is well above the
 * old hardcoded 0.05. The deposit transaction itself lives in the parent
 * (JudgeAll) so the "Deposit more & retry" recovery path can reuse it.
 */
export function RitualWalletPanel({
  status,
  amount,
  onAmountChange,
  onDeposit,
  depositTx,
  validationError,
  highlight,
}: {
  status: Status;
  amount: string;
  onAmountChange: (value: string) => void;
  onDeposit: () => void;
  depositTx: WriteTx;
  validationError?: string | null;
  highlight?: boolean;
}) {
  // Loading the three reads — show a neutral placeholder, don't block.
  if (!status.hasData) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <Spinner /> Checking RitualWallet funding…
      </div>
    );
  }

  const { ready, lockExpired, balance } = status;

  const badge = ready ? (
    <Badge tone="green">RitualWallet ready</Badge>
  ) : lockExpired ? (
    <Badge tone="red">Lock expired</Badge>
  ) : (
    <Badge tone="amber">Deposit required</Badge>
  );

  // Validate the typed amount for the button's enabled state.
  let parsedAmount: bigint | null = null;
  try {
    const v = parseEther(amount.trim() === "" ? "0" : amount.trim());
    parsedAmount = v > 0n ? v : null;
  } catch {
    parsedAmount = null;
  }
  const canDeposit = parsedAmount !== null && !depositTx.isBusy;

  return (
    <div
      className={`space-y-3 rounded-xl p-3 ring-1 ring-inset ${
        highlight
          ? "bg-[#b98a2e]/[0.06] ring-[#b98a2e]/35"
          : "bg-cream/40 ring-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
          LLM fees
        </span>
        {badge}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        AI judging runs as an async job and needs a fee deposit. Larger jobs cost
        more. Unused balance stays available.
      </p>

      <dl className="space-y-0.5 font-mono text-[11px] text-ink">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">RitualWallet balance</dt>
          <dd>{formatEther(balance ?? 0n)} RITUAL</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Est. escrow per run</dt>
          <dd>~{formatEther(JUDGE_ESCROW_ESTIMATE_WEI)} RITUAL</dd>
        </div>
      </dl>

      <Field
        label="Deposit amount (RITUAL)"
        hint={`Locks funds for ${LOCK_DURATION.toLocaleString()} blocks. ${formatEther(
          DEFAULT_JUDGE_DEPOSIT,
        )} RITUAL is a safe default; raise it for more headroom.`}
      >
        <Input
          inputMode="decimal"
          className="font-mono"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder={formatEther(DEFAULT_JUDGE_DEPOSIT)}
        />
      </Field>

      {validationError && <p className="text-xs text-brick">{validationError}</p>}

      <Button
        onClick={onDeposit}
        disabled={!canDeposit}
        variant={ready ? "secondary" : "primary"}
        className="w-full"
      >
        {depositTx.isBusy
          ? "Depositing…"
          : `Deposit ${
              parsedAmount !== null
                ? amount.trim()
                : formatEther(DEFAULT_JUDGE_DEPOSIT)
            } RITUAL`}
      </Button>

      <TxStatus
        state={depositTx.state}
        error={depositTx.error}
        hash={depositTx.hash}
        explorerBase={explorerBase}
      />

      {ready && (
        <Notice tone="green">
          Funded and ready. You can run AI judging. Unused balance can be
          withdrawn once the lock expires.
        </Notice>
      )}
    </div>
  );
}
