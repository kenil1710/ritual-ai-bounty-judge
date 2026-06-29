import { parseEther, type PublicClient } from "viem";
import { RITUAL_WALLET, ritualWalletAbi } from "@/abi/RitualWallet";

/**
 * Funding requirements for running an AI judging (`judgeAll`) transaction.
 *
 * `judgeAll` fires Ritual's async LLM precompile, which escrows a worst-case fee
 * from the caller's RitualWallet at submission time (see JUDGE_ESCROW_ESTIMATE_WEI
 * in `ritualLlm` — ~0.31 RITUAL for the pinned model). To run a judge the wallet
 * must hold at least that escrow and keep it locked long enough to outlive the
 * async callback. Deposits are monotonic: each one only extends the lock and
 * adds to the balance, and unused balance can be withdrawn once the lock lapses.
 */

/**
 * Balance we treat as "ready to judge". The ritual-dapp-llm guide recommends
 * depositing at least 0.4 RITUAL before the first call, comfortably above the
 * ~0.31 worst-case escrow, so we use that as the readiness floor.
 */
export const MIN_LLM_BALANCE = parseEther("0.4");

/**
 * Amount the deposit field is pre-filled with: the ~0.31 escrow plus headroom,
 * matching the guide's own deposit example. The owner can change it. Bigger
 * judging jobs don't need a bigger escrow (it's a fixed worst-case), but extra
 * balance is never lost.
 */
export const DEFAULT_JUDGE_DEPOSIT = parseEther("0.5");

/** How long (in blocks) a deposit locks funds for (~9.7h at dev block cadence). */
export const LOCK_DURATION = 100_000n;

/** Lock must extend at least this many blocks past the current block. */
export const REQUIRED_TTL_BUFFER = 300n;

export type RitualWalletStatus = {
  balance: bigint;
  lockUntil: bigint;
  currentBlock: bigint;
  hasEnoughBalance: boolean;
  hasEnoughLockDuration: boolean;
  /** Lock has already elapsed (or was never set). */
  lockExpired: boolean;
  ready: boolean;
};

/**
 * One-shot read of the connected wallet's RitualWallet funding state. Reads the
 * balance + lock against the *user* address (never the bounty contract) and
 * compares the lock to the live block number.
 */
export async function getRitualWalletStatus({
  publicClient,
  user,
}: {
  publicClient: PublicClient;
  user: `0x${string}`;
}): Promise<RitualWalletStatus> {
  const [balance, lockUntil, currentBlock] = await Promise.all([
    publicClient.readContract({
      address: RITUAL_WALLET,
      abi: ritualWalletAbi,
      functionName: "balanceOf",
      args: [user],
    }),
    publicClient.readContract({
      address: RITUAL_WALLET,
      abi: ritualWalletAbi,
      functionName: "lockUntil",
      args: [user],
    }),
    publicClient.getBlockNumber(),
  ]);

  return deriveStatus(balance, lockUntil, currentBlock);
}

/** Pure comparison shared by the helper and the React hook. */
export function deriveStatus(
  balance: bigint,
  lockUntil: bigint,
  currentBlock: bigint,
): RitualWalletStatus {
  const hasEnoughBalance = balance >= MIN_LLM_BALANCE;
  const hasEnoughLockDuration = lockUntil >= currentBlock + REQUIRED_TTL_BUFFER;
  const lockExpired = lockUntil <= currentBlock;
  return {
    balance,
    lockUntil,
    currentBlock,
    hasEnoughBalance,
    hasEnoughLockDuration,
    lockExpired,
    ready: hasEnoughBalance && hasEnoughLockDuration,
  };
}
