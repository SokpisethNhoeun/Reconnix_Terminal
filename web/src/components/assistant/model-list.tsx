"use client";

/* The Model menu's list: every provider with its models as choices, the Environment (from
   web/.env.local, read-only) first. One click (or Enter / Space) on a model makes it the one
   that answers next; the active one is checked. Each provider's models are a radio group with
   one tab stop (the arrow keys move between its models; choosing is a deliberate Enter, Space
   or click, since it saves). A saved provider can be edited or removed (asked first). A model
   that can't be used now is disabled with the reason. */
import { useId, useState } from "react";
import { Check, Loader, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { ENVIRONMENT } from "@/lib/assistant/models/schema";
import type { ModelsView, ProviderView } from "@/lib/assistant/models/view";
import { choiceKey, type Models } from "./use-models";

const REMOTE_OFF = "This address is off this machine: the dashboard must be started with LLM_ALLOW_REMOTE=1 to use it.";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Up/Down/Left/Right, Home and End move focus between a group's models (they don't choose). */
function moveFocus(e: React.KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0 || !radios.length) return;
  e.preventDefault();
  const next = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (at + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + radios.length) % radios.length;
  radios.forEach((r, i) => (r.tabIndex = i === next ? 0 : -1));
  radios[next].focus();
}

interface GroupProps {
  providerId: string;
  name: string;
  meta: string;
  names: string[];
  view: ModelsView;
  models: Models;
  disabled: string | null; // why its models can't be chosen now
  provider?: ProviderView; // a saved one (editable)
  onEdit?: () => void;
}

function ProviderGroup({ providerId, name, meta, names, view, models, disabled, provider, onEdit }: GroupProps) {
  const headingId = useId();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pending } = models;
  const chosen = view.active?.providerId === providerId ? view.active.model : null;
  const focusable = chosen && names.includes(chosen) ? chosen : names[0];

  const pick = async (model: string) => {
    if (disabled || pending || model === chosen) return;
    setError(null);
    const problem = await models.choose(providerId, model);
    if (problem) setError(problem);
  };
  const remove = async () => {
    setError(null);
    const problem = await models.remove(providerId);
    if (problem) setError(problem);
  };

  return (
    <section className="ai-model-group" aria-labelledby={headingId} data-provider={providerId}>
      <div className="ai-model-group-head">
        <div className="min-w-0">
          <p id={headingId} className="ai-model-name">
            {name}
            {!provider && (
              <Badge variant="muted" className="ml-2 align-middle">
                read-only
              </Badge>
            )}
          </p>
          <p className="ai-model-meta">{meta}</p>
        </div>
        {provider && onEdit && (
          <span className="ai-model-actions">
            <IconButton label={`Edit ${name}`} onClick={onEdit} data-edit={providerId} className="size-7 [&_svg]:size-3.5">
              <Pencil aria-hidden />
            </IconButton>
            <IconButton
              label={`Remove ${name}`}
              onClick={() => {
                setError(null);
                setConfirm(true);
              }}
              className="size-7 hover:text-danger [&_svg]:size-3.5"
            >
              <Trash2 aria-hidden />
            </IconButton>
          </span>
        )}
      </div>
      {confirm ? (
        <div className="ai-menu-confirm" role="group" aria-label={`Remove ${name}?`}>
          <p className="text-foreground">
            Remove <span className="font-medium">“{name}”</span>{provider?.keySaved ? " and its saved API key" : ""}? This can&apos;t be undone.
          </p>
          {error && <p className="ai-error-text mt-1" role="alert">{error}</p>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button type="button" autoFocus onClick={() => setConfirm(false)} className="ai-btn ai-btn-small ai-btn-outline">
              Cancel
            </button>
            <button type="button" onClick={remove} disabled={pending !== null} className="ai-btn ai-btn-small ai-btn-danger-solid">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-labelledby={headingId} aria-describedby={disabled ? `${headingId}-off` : undefined} onKeyDown={moveFocus} className="ai-model-options">
            {names.map((model) => {
              const checked = model === chosen;
              const busy = pending === choiceKey(providerId, model);
              return (
                <button
                  key={model}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={disabled ? true : undefined}
                  tabIndex={model === focusable ? 0 : -1}
                  onClick={() => void pick(model)}
                  title={disabled ?? (checked ? "Answers your next question" : `Use ${model}`)}
                  className="ai-model-option"
                >
                  <span className="ai-model-check" aria-hidden>
                    {busy ? <Loader className="size-3.5 animate-spin" /> : checked ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="ai-model-option-name">{model}</span>
                </button>
              );
            })}
          </div>
          {disabled && (
            <p id={`${headingId}-off`} className="ai-model-reason">
              {disabled}
            </p>
          )}
          {error && (
            <p className="ai-error-text px-2 pt-1" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function ModelList({ models, onEdit }: { models: Models; onEdit: (providerId: string) => void }) {
  const { state, pending } = models;
  const view = state.view;

  if (!view) {
    return (
      <div className="ai-menu-list">
        {state.status === "error" ? (
          <div className="ai-menu-state" role="alert">
            <p>Couldn&apos;t load the models: {state.error}</p>
            <button type="button" onClick={models.load} className="ai-btn ai-btn-small ai-btn-outline mt-2">
              Try again
            </button>
          </div>
        ) : (
          <p className="ai-menu-state" role="status">
            <Loader className="mr-1.5 inline size-3.5 animate-spin" aria-hidden /> Loading the models…
          </p>
        )}
      </div>
    );
  }

  const env = view.environment;
  return (
    <div className="ai-menu-list" aria-busy={pending !== null}>
      {state.status === "error" && (
        <p className="ai-error-text px-2 pt-2" role="alert">
          {state.error}
        </p>
      )}
      {env && (
        <ProviderGroup
          providerId={ENVIRONMENT}
          name={env.name}
          meta={`web/.env.local · ${env.local ? "local" : "remote"}`}
          names={[env.model]}
          view={view}
          models={models}
          disabled={env.reason || null}
        />
      )}
      {view.providers.map((p) => (
        <ProviderGroup
          key={p.id}
          providerId={p.id}
          name={p.name}
          meta={`${hostOf(p.baseUrl)} · ${p.local ? "local" : "remote"}${p.keySaved ? " · key saved" : ""}`}
          names={p.models}
          view={view}
          models={models}
          disabled={!p.local && !view.allowRemote ? REMOTE_OFF : null}
          provider={p}
          onEdit={() => onEdit(p.id)}
        />
      ))}
      {!env && !view.providers.length && (
        <p className="ai-menu-state">
          No model yet. Add a local one (Ollama, LM Studio) or a provider with its API key; the assistant asks the one you choose here.
        </p>
      )}
    </div>
  );
}
