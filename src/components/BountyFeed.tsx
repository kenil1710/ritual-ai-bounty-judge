"use client";

import { useMemo, useState } from "react";
import { useBountyFeed, type BountyFeedItem } from "@/hooks/useBountyFeed";
import { useNow } from "@/hooks/useNow";
import { getBountyPhase, PHASE_META } from "@/lib/bounty";
import { formatReward } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Input,
  Spinner,
} from "@/components/ui";

/**
 * BountyFeed — the on-chain activity feed. Discovers every bounty by walking the
 * contract's minted ids (see `useBountyFeed`), newest first. A search box filters
 * live by id or title; clicking a card opens it. Phase + commitment count come
 * straight from each bounty's current on-chain state.
 */
export function BountyFeed({
  selectedId,
  onSelect,
}: {
  selectedId: bigint | null;
  onSelect: (id: bigint) => void;
}) {
  const { bounties, isLoading, isError } = useBountyFeed();
  const now = useNow();
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (q === "") return bounties;
    return bounties.filter(
      (b) => b.id.toString().includes(q) || b.title.toLowerCase().includes(q),
    );
  }, [bounties, q]);

  return (
    <Card>
      <CardHeader
        title="Live bounties"
        subtitle="Every bounty on-chain, newest first."
        action={
          !isLoading && !isError ? (
            <Badge tone="zinc">{bounties.length}</Badge>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Reading bounties from the chain…
          </div>
        ) : isError ? (
          <p className="text-sm text-brick">
            Couldn&apos;t read bounties from the chain. Check the RPC connection
            and try again.
          </p>
        ) : bounties.length === 0 ? (
          <EmptyFeed />
        ) : (
          <>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by id or title…"
              aria-label="Search bounties by id or title"
            />
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No bounties match{" "}
                <span className="font-mono text-ink">
                  &ldquo;{search.trim()}&rdquo;
                </span>
                .
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((b) => (
                  <BountyFeedCard
                    key={b.id.toString()}
                    item={b}
                    now={now}
                    selected={selectedId === b.id}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function EmptyFeed() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-10 text-center">
      <p className="font-serif text-base text-ink">No bounties yet.</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
        Create one above and it&apos;ll show up here.
      </p>
    </div>
  );
}

function BountyFeedCard({
  item,
  now,
  selected,
  onSelect,
}: {
  item: BountyFeedItem;
  now: number;
  selected: boolean;
  onSelect: (id: bigint) => void;
}) {
  // Everything is read from the bounty's live on-chain state in the feed item.
  const phase = getBountyPhase(item, now);
  const meta = PHASE_META[phase];
  const commitments = item.commitmentCount;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-pressed={selected}
        className={`flex w-full flex-col rounded-xl border p-4 text-left transition-colors ${
          selected
            ? "border-brand/50 bg-brand/[0.06]"
            : "border-line bg-cream/50 hover:border-brand/30 hover:bg-brand/[0.04]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted">
            #{item.id.toString()}
          </span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        <h3 className="mt-2 line-clamp-2 font-serif text-base font-medium text-ink">
          {item.title || "Untitled"}
        </h3>

        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="font-mono text-ink">{formatReward(item.reward)}</span>
          <span className="text-xs text-muted">
            {commitments.toString()}{" "}
            {commitments === 1n ? "commitment" : "commitments"}
          </span>
        </div>
      </button>
    </li>
  );
}
