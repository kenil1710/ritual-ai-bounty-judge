"use client";

import { useCallback, useSyncExternalStore } from "react";
import { contractAddress } from "@/config/contract";

// Scope the recent list to the ACTIVE contract address. Bounty ids only mean
// something for the contract they were created on, so a redeploy (new address)
// must never surface ids from an old contract. The address is fixed per build.
const STORAGE_KEY = `aibj:recent-bounties:${contractAddress ?? "none"}`;
// The previous unscoped key mixed ids across contracts — drop it for good.
const LEGACY_KEY = "aibj:recent-bounties";
const MAX = 20;
const EMPTY: string[] = [];

// One-time cleanup of the legacy unscoped key so old-contract ids can never be
// read again. Guarded for SSR; runs once when this client module is imported.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

// Cache the parsed array so getSnapshot returns a stable reference until the
// underlying string actually changes (required by useSyncExternalStore).
let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };
const listeners = new Set<() => void>();

function readSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.value;
  let value: string[] = EMPTY;
  try {
    value = raw ? (JSON.parse(raw) as string[]) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function serverSnapshot(): string[] {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function persist(next: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  listeners.forEach((l) => l());
}

/**
 * Recently created/opened bounty ids for the active contract, persisted in
 * localStorage. Backed by useSyncExternalStore so it's hydration-safe (server
 * renders an empty list) without needing a `mounted` flag.
 */
export function useRecentBounties() {
  const ids = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);

  const add = useCallback((id: string | bigint) => {
    const key = id.toString();
    const current = readSnapshot();
    if (current[0] === key) return;
    persist([key, ...current.filter((x) => x !== key)].slice(0, MAX));
  }, []);

  const remove = useCallback((id: string | bigint) => {
    const key = id.toString();
    persist(readSnapshot().filter((x) => x !== key));
  }, []);

  return { ids, add, remove };
}
