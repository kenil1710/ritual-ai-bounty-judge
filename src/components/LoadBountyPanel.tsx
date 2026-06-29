"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody, Field, Input, Button } from "@/components/ui";

export function LoadBountyPanel({
  selectedId,
  onSelect,
  recentIds,
}: {
  selectedId: bigint | null;
  onSelect: (id: bigint | null) => void;
  recentIds: string[];
}) {
  // `override === null` => show the current selection; typing takes over.
  const [override, setOverride] = useState<string | null>(null);
  const value =
    override ?? (selectedId !== null ? selectedId.toString() : "");

  function load(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onSelect(null);
      return;
    }
    try {
      const id = BigInt(trimmed);
      if (id < 0n) return;
      onSelect(id);
    } catch {
      /* not a number — ignore */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Load a bounty"
        subtitle="Open any bounty by its numeric id."
      />
      <CardBody className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(value);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Field label="Bounty id">
              <Input
                inputMode="numeric"
                className="font-mono"
                value={value}
                onChange={(e) => setOverride(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
          <Button type="submit">Load</Button>
        </form>

        {recentIds.length > 0 && (
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
              Recent
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentIds.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setOverride(null);
                    load(id);
                  }}
                  className={`rounded-lg px-2 py-1 font-mono text-xs ring-1 ring-inset transition-colors ${
                    selectedId?.toString() === id
                      ? "bg-brand/10 text-brand ring-brand/30"
                      : "bg-cream/60 text-muted ring-line hover:bg-brand/5 hover:text-ink"
                  }`}
                >
                  #{id}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
