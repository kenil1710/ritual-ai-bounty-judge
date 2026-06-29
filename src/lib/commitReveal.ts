import {
  keccak256,
  encodePacked,
  type Address,
  type Hex,
} from "viem";

/**
 * ============================================================================
 *  Commit-reveal helpers
 * ============================================================================
 *
 * The contract hides answers during the submission phase. A participant first
 * submits ONLY:
 *
 *     commitment = keccak256(abi.encodePacked(answer, salt, sender, bountyId))
 *
 * and later reveals (answer, salt). The contract recomputes the hash and checks
 * it matches.
 *
 * The single biggest UX risk in any commit-reveal app: if the user loses their
 * `salt`, they can NEVER reveal and their reward chance is gone forever. So the
 * moment we generate a salt we persist {answer, salt} locally, keyed by
 * (chainId, contract, bountyId, account). The Reveal step reads it straight
 * back, so the user never has to copy a hex string by hand.
 *
 * localStorage is per-browser, so we also let the user export/copy their
 * salt as a backup in the UI.
 */

export type StoredCommitment = {
  bountyId: string;
  account: Address;
  answer: string;
  salt: Hex;
  commitment: Hex;
  createdAt: number;
  revealedAt?: number;
};

/** Generate a cryptographically-random 32-byte salt. */
export function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}

/**
 * Compute the commitment hash exactly as the Solidity contract does:
 *   keccak256(abi.encodePacked(answer, salt, sender, bountyId))
 */
export function computeCommitment(params: {
  answer: string;
  salt: Hex;
  sender: Address;
  bountyId: bigint;
}): Hex {
  return keccak256(
    encodePacked(
      ["string", "bytes32", "address", "uint256"],
      [params.answer, params.salt, params.sender, params.bountyId],
    ),
  );
}

// ---- local persistence ----------------------------------------------------

function storageKey(
  chainId: number,
  contract: Address,
  bountyId: string,
  account: Address,
): string {
  return `crj:${chainId}:${contract.toLowerCase()}:${bountyId}:${account.toLowerCase()}`;
}

export function saveCommitment(
  chainId: number,
  contract: Address,
  c: StoredCommitment,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(chainId, contract, c.bountyId, c.account);
  window.localStorage.setItem(key, JSON.stringify(c));
}

export function loadCommitment(
  chainId: number,
  contract: Address,
  bountyId: string,
  account: Address,
): StoredCommitment | null {
  if (typeof window === "undefined") return null;
  const key = storageKey(chainId, contract, bountyId, account);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCommitment;
  } catch {
    return null;
  }
}

export function markRevealed(
  chainId: number,
  contract: Address,
  bountyId: string,
  account: Address,
): void {
  const existing = loadCommitment(chainId, contract, bountyId, account);
  if (!existing) return;
  existing.revealedAt = Date.now();
  saveCommitment(chainId, contract, existing);
}
