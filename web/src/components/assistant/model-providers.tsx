"use client";

/* The model picker's step 1, "Add or change a provider": the presets in their order (OpenAI,
   Anthropic, DeepSeek, OpenRouter, Groq, Ollama, LM Studio, Custom), each the saved provider
   made from it or the preset itself, with its state ("key saved", "local" or "remote" for a saved
   one, by its address; "cloud" or "local" for a preset). A provider saved under a cloud preset
   at another address is listed under Custom, with its host. Choosing a row goes to its
   credentials (step 2). A cloud row is disabled while the server
   keeps data on this machine, and says why (the note under the heading). A saved provider has
   Remove beside its row: an inline confirm, focused on No; Escape there keeps it. One tab stop
   for the rows and their Remove buttons (use-roving.ts). */
import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Loader, Trash2 } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import type { ModelsView } from "@/lib/assistant/models/view";
import { CLOUD_OFF, type ProviderRow, providerRows } from "./model-picker-rules";
import type { Models } from "./use-models";
import { useRoving } from "./use-roving";

const rowKey = (key: string) => `row:${key}`;
const removeKey = (key: string) => `remove:${key}`;

interface Props {
  view: ModelsView;
  models: Models;
  onPick: (row: ProviderRow) => void;
}

export function ProviderList({ view, models, onPick }: Props) {
  const headingId = useId();
  const offId = useId();
  const list = useRef<HTMLUListElement>(null);
  const rows = providerRows(view);
  const [confirm, setConfirm] = useState<string | null>(null); // the provider asked about
  const [error, setError] = useState<string | null>(null);
  const focusNext = useRef<string | null>(null); // a roving key to focus once drawn
  const shown = rows.filter((r) => r.provider?.id !== confirm);
  const roving = useRoving(
    shown.flatMap((r) => (r.provider ? [rowKey(r.key), removeKey(r.key)] : [rowKey(r.key)])),
    null,
  );
  const asked = confirm ? rows.find((r) => r.provider?.id === confirm) : undefined;

  // after a confirm closes, focus goes back to its Remove button (or, removed, to the row that
  // took its place)
  useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    focusNext.current = null;
    const el = list.current?.querySelector<HTMLElement>(`[data-rove="${key}"]`) ?? list.current?.querySelector<HTMLElement>('[data-rove][tabindex="0"]');
    el?.focus({ preventScroll: true });
  });

  const keep = (row: ProviderRow) => {
    setConfirm(null);
    setError(null);
    focusNext.current = removeKey(row.key);
  };
  const remove = async (row: ProviderRow) => {
    if (!row.provider) return;
    setError(null);
    const problem = await models.remove(row.provider.id);
    if (problem) return setError(problem);
    focusNext.current = rowKey(row.preset.id); // the preset's own row, when no other provider took it
    setConfirm(null);
  };

  return (
    <section aria-labelledby={headingId} className="ai-picker-section">
      <h3 id={headingId} className="ai-picker-heading">
        Add or change a provider
      </h3>
      {!view.allowRemote && (
        <p id={offId} className="ai-picker-off">
          {CLOUD_OFF}
        </p>
      )}
      <ul ref={list} aria-labelledby={headingId} onKeyDown={roving.onKeyDown} className="ai-picker-list">
        {rows.map((row) =>
          row === asked && row.provider ? (
            <li
              key={row.key}
              role="group"
              aria-label={`Remove ${row.provider.name}?`}
              className="ai-menu-confirm"
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                e.preventDefault(); // keeps it; the picker stays open
                e.stopPropagation();
                keep(row);
              }}
            >
              <p className="text-foreground">
                Remove <span className="font-medium">{row.provider.name}</span>
                {row.provider.keySaved ? " and its saved API key" : ""}? Its models leave Your models.
              </p>
              {error && (
                <p className="ai-error-text mt-1" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-1.5">
                <button type="button" autoFocus onClick={() => keep(row)} className="ai-btn ai-btn-small ai-btn-outline">
                  No
                </button>
                <button type="button" onClick={() => void remove(row)} disabled={models.pending !== null} className="ai-btn ai-btn-small ai-btn-danger-solid">
                  {models.pending === `remove:${row.provider.id}` && <Loader className="size-3.5 animate-spin" aria-hidden />}
                  Remove
                </button>
              </div>
            </li>
          ) : (
            <li key={row.key} className="ai-picker-row">
              <button
                type="button"
                aria-disabled={row.disabled ? true : undefined}
                aria-describedby={row.disabled ? offId : undefined}
                title={row.disabled ?? undefined}
                onClick={() => !row.disabled && onPick(row)}
                className="ai-picker-provider"
                {...roving.item(rowKey(row.key))}
              >
                <span className="ai-picker-provider-name">{row.label}</span>
                {row.state && (
                  <span className="ai-picker-state" data-state={row.state.replace(" ", "-")}>
                    <span className="sr-only">, </span>
                    {row.state}
                  </span>
                )}
                <ChevronRight className="ai-picker-go size-3.5" aria-hidden />
              </button>
              {row.provider && (
                <IconButton
                  label={`Remove ${row.provider.name}`}
                  onClick={() => {
                    setError(null);
                    setConfirm(row.provider!.id);
                  }}
                  className="ai-picker-remove size-7 hover:text-danger [&_svg]:size-3.5"
                  {...roving.item(removeKey(row.key))}
                >
                  <Trash2 aria-hidden />
                </IconButton>
              )}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
