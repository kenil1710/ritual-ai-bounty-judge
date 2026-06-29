"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { WalletConnect } from "@/components/WalletConnect";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { LoadBountyPanel } from "@/components/LoadBountyPanel";
import { BountyView } from "@/components/BountyView";
import { HowItWorks } from "@/components/HowItWorks";
import { BountyFeed } from "@/components/BountyFeed";
import { About } from "@/components/About";
import { useRecentBounties } from "@/hooks/useRecentBounties";
import { isContractConfigured, contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Notice } from "@/components/ui";

const HERO_CHIPS = [
  "Answers stay hidden until the reveal phase.",
  "The owner picks the winner, not the AI.",
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.198.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const { ids, add } = useRecentBounties();

  // Track any opened bounty in the recent list too. `add` is a no-op when the
  // id is already most-recent, so this won't loop.
  useEffect(() => {
    if (selectedId !== null) add(selectedId);
  }, [selectedId, add]);

  const handleCreated = useCallback(
    (id: bigint) => {
      add(id);
      setSelectedId(id);
    },
    [add],
  );

  return (
    <div className="min-h-full">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/ritual-logo.jpg"
              alt="Ritual"
              width={36}
              height={36}
              priority
              className="rounded-lg ring-1 ring-line"
            />
            <div className="leading-tight">
              <h1 className="font-serif text-lg font-medium text-ink">
                AI Bounty Judge
              </h1>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                on {ritualChain.name}
              </p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Hero / explanation */}
        <section className="mb-12">
          <h2 className="max-w-3xl font-serif text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Crowd-judged bounties, settled by AI.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
            Commit a hidden answer, then reveal it after the deadline. The AI
            judges the revealed answers in one batch, and the owner picks the
            winner.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {HERO_CHIPS.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-bright" />
                {chip}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <HowItWorks />

        {!isContractConfigured && (
          <div className="mb-8">
            <Notice tone="amber">
              No contract address configured. Copy{" "}
              <code className="font-mono">.env.example</code> to{" "}
              <code className="font-mono">.env.local</code> and set{" "}
              <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> to
              start interacting on-chain.
            </Notice>
          </div>
        )}

        {/* Dashboard: create + load */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CreateBountyForm onCreated={handleCreated} />
          <LoadBountyPanel
            selectedId={selectedId}
            onSelect={setSelectedId}
            recentIds={ids}
          />
        </section>

        {/* Activity feed: every bounty created on-chain */}
        <section className="mt-8">
          <BountyFeed selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        {/* Selected bounty */}
        {selectedId !== null && (
          <section className="mt-8">
            <BountyView bountyId={selectedId} />
          </section>
        )}

        <About />

        <footer className="mt-12 border-t border-line pt-6">
          <div className="flex flex-col gap-5 text-xs text-muted sm:flex-row sm:items-start sm:justify-between">
            {/* Attribution + socials */}
            <div className="flex flex-col gap-2.5">
              <span>
                Built by{" "}
                <span className="font-medium text-ink">Kenil Vakariya</span>
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href="https://x.com/vekariya_kenil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  <span className="font-mono">@vekariya_kenil</span>
                </a>
                <span className="inline-flex items-center gap-1.5">
                  <DiscordIcon className="h-4 w-4" />
                  <span className="font-mono">kency17</span>
                </span>
              </div>
            </div>

            {/* Chain / contract status */}
            <div className="flex flex-col gap-2.5 sm:items-end">
              {contractAddress ? (
                <span className="inline-flex items-center gap-1.5">
                  Contract
                  <a
                    href={`${ritualChain.blockExplorers?.default.url}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-brand underline underline-offset-2 hover:text-brand/70"
                  >
                    {shortenAddress(contractAddress, 6)}
                  </a>
                </span>
              ) : (
                <span>Workshop demo · {ritualChain.name}</span>
              )}
              <span className="inline-flex items-center gap-2 font-mono">
                <span className="relative inline-flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-bright opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-bright" />
                </span>
                Chain {ritualChain.id} · Ritual testnet
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
