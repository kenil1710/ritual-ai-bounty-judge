"use client";

import { useCallback } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { COMMIT_REVEAL_AI_JUDGE_ABI } from "@/abi/CommitRevealAIJudge";
import { contractAddress, isContractConfigured } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { parseBounty, type Bounty } from "@/lib/bounty";

/**
 * One bounty in the feed: its id plus the full parsed on-chain state. Carrying
 * the whole struct lets each card show the live phase + commitment count without
 * a second per-card read.
 */
export type BountyFeedItem = Bounty & { id: bigint };

/**
 * The full bounty activity feed, discovered by walking every id the contract has
 * minted rather than scanning event logs. `nextBountyId` starts at 1 and is
 * assigned monotonically (`bountyId = nextBountyId++`), so the live bounties are
 * exactly ids 1 … nextBountyId-1. We read `getBounty` for each — batched, and
 * tolerant of a single id failing — which stays robust no matter how far back
 * the deploy is (Ritual's RPC rejects very wide `eth_getLogs` ranges, which the
 * old log-scanning approach had to page around). New bounties appear live via
 * the `BountyCreated` watcher, and a periodic refetch keeps phases/counts fresh.
 * Returned newest-first. Never mocked — only real contract reads.
 */
export function useBountyFeed() {
  const client = usePublicClient({ chainId: ritualChain.id });

  const query = useQuery({
    queryKey: ["bounty-feed", contractAddress, ritualChain.id],
    enabled: isContractConfigured && !!client,
    refetchInterval: 15_000,
    queryFn: async (): Promise<BountyFeedItem[]> => {
      if (!client || !contractAddress) return [];
      // Capture the narrowed address so the per-id read closures below keep it
      // typed as `Address` (TS drops the guard's narrowing across closures).
      const address = contractAddress;

      const nextId = await client.readContract({
        address,
        abi: COMMIT_REVEAL_AI_JUDGE_ABI,
        functionName: "nextBountyId",
      });

      // Live ids are 1 … nextId-1; nothing to read before the first bounty.
      const count = nextId > 1n ? Number(nextId - 1n) : 0;
      if (count <= 0) return [];
      const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

      // Read every bounty in parallel. A single id failing (transient RPC error,
      // a reverted read) must not sink the whole feed, so each read is caught and
      // dropped rather than rejecting the batch.
      const results = await Promise.all(
        ids.map(async (id): Promise<BountyFeedItem | null> => {
          try {
            const raw = await client.readContract({
              address,
              abi: COMMIT_REVEAL_AI_JUDGE_ABI,
              functionName: "getBounty",
              args: [id],
            });
            return { id, ...parseBounty(raw) };
          } catch {
            return null;
          }
        }),
      );

      return results
        .filter((b): b is BountyFeedItem => b !== null)
        .sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)); // newest first
    },
  });

  // Live: refetch when a new bounty is created so it appears without a reload.
  const refetch = query.refetch;
  const onLogs = useCallback(() => {
    void refetch();
  }, [refetch]);

  useWatchContractEvent({
    address: contractAddress,
    abi: COMMIT_REVEAL_AI_JUDGE_ABI,
    eventName: "BountyCreated",
    chainId: ritualChain.id,
    enabled: isContractConfigured,
    onLogs,
  });

  return {
    bounties: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
