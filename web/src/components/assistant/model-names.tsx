"use client";

/* The model names of a provider in the Model menu's form: chips with a remove button, a field
   that adds one (Enter or Add), and, once "Fetch models" has asked the server, the names it
   lists as checkboxes that add or remove them. The server checks every name again. */
import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { MAX_MODELS, MODEL_NAME } from "@/lib/assistant/models/schema";

interface Props {
  value: string[];
  onChange: (names: string[]) => void;
  fetched: string[] | null; // what "Fetch models" found (null: not asked yet)
}

export function ModelNames({ value, onChange, fetched }: Props) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const errorId = useId();

  const add = () => {
    const name = typed.trim();
    if (!name) return;
    if (!MODEL_NAME.test(name)) return setError("A model name uses letters, digits and . _ : / @ + - only (at most 128).");
    if (value.includes(name)) return setError("That model is listed already.");
    if (value.length >= MAX_MODELS) return setError(`At most ${MAX_MODELS} models.`);
    onChange([...value, name]);
    setTyped("");
    setError(null);
  };
  const toggle = (name: string, on: boolean) => {
    if (on && !value.includes(name) && value.length < MAX_MODELS) onChange([...value, name]);
    if (!on) onChange(value.filter((n) => n !== name));
  };

  return (
    <div className="ai-field" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="ai-label">
        Models
      </p>
      {value.length > 0 ? (
        <ul className="ai-model-chips" aria-label="Models of this provider">
          {value.map((name) => (
            <li key={name} className="ai-model-chip">
              <span className="min-w-0 truncate">{name}</span>
              <IconButton label={`Remove ${name} from the list`} onClick={() => onChange(value.filter((n) => n !== name))} className="size-5 shrink-0 rounded-md [&_svg]:size-3">
                <X aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ai-hint">No model yet: type a name, or fetch the server&apos;s list.</p>
      )}
      <div className="flex items-center gap-1.5">
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // adds the name; never submits the form
              add();
            }
          }}
          maxLength={128}
          spellCheck={false}
          autoComplete="off"
          placeholder="e.g. llama3.2"
          aria-label="A model name to add"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="ai-input"
        />
        <button type="button" onClick={add} disabled={!typed.trim()} className="ai-btn ai-btn-small ai-btn-outline shrink-0">
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      </div>
      {error && (
        <p id={errorId} className="ai-error-text" role="alert">
          {error}
        </p>
      )}
      {fetched && (
        <fieldset className="ai-model-fetched">
          <legend className="ai-hint">{fetched.length ? `The server lists ${fetched.length} ${fetched.length === 1 ? "model" : "models"}:` : "The server lists no models."}</legend>
          {fetched.length > 0 && (
            <div className="ai-model-fetched-list">
              {fetched.map((name) => (
                <Checkbox key={name} label={name} checked={value.includes(name)} onChange={(e) => toggle(name, e.target.checked)} className="ai-model-fetched-item" />
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
