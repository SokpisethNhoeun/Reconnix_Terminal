"use client";

/* The Settings "AI models" manager. A visual mock: there is no backend for model keys in
   this version, so nothing is stored and "Test connection" is simulated. Expanding a
   provider, toggling the key and the fields all work client-side. */
import { Check, ChevronRight, Diamond, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/neu/chips";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type State = "default" | "connected" | "not-set";

interface Provider {
  id: string;
  name: string;
  mark: string; // the little square badge, e.g. "AI", "DS"
  desc: string;
  state: State;
  keyUrl?: string;
  models?: string[];
  baseUrlPlaceholder?: string;
  needsBaseUrl?: boolean;
}

const PROVIDERS: Provider[] = [
  { id: "openai", name: "OpenAI", mark: "AI", desc: "GPT models", state: "not-set", keyUrl: "https://platform.openai.com/api-keys", models: ["gpt-4o", "gpt-4o-mini"] },
  { id: "anthropic", name: "Anthropic", mark: "A\\", desc: "Claude models", state: "not-set", keyUrl: "https://console.anthropic.com/settings/keys", models: ["claude-opus-4-8", "claude-sonnet-5-5", "claude-haiku-5-5"] },
  { id: "deepseek", name: "DeepSeek", mark: "DS", desc: "DeepSeek models", state: "connected", keyUrl: "https://platform.deepseek.com/api_keys", models: ["deepseek-chat", "deepseek-reasoner"], baseUrlPlaceholder: "https://api.deepseek.com" },
  { id: "openai-compat", name: "OpenAI-compatible", mark: "{}", desc: "Any server with an OpenAI-style API, e.g. Ollama, LM Studio, vLLM", state: "not-set", needsBaseUrl: true, models: ["(enter a model id)"] },
];

function StateBadge({ state }: { state: State }) {
  if (state === "connected")
    return (
      <Badge tone="ok">
        <Check size={11} aria-hidden /> Connected
      </Badge>
    );
  return <span className="chip text-muted">Not set</span>;
}

function ProviderPanel({ p }: { p: Provider }) {
  const [reveal, setReveal] = useState(false);
  const [key, setKey] = useState(p.state === "connected" ? "sk-••••••••••••3f9a" : "");
  const [status, setStatus] = useState<"idle" | "testing" | "passed">(p.state === "connected" ? "passed" : "idle");

  const test = () => {
    setStatus("testing");
    window.setTimeout(() => setStatus("passed"), 900);
  };

  return (
    <div className="flex flex-col gap-5 border-t border-line bg-well/40 px-5 py-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
          API key
          <span className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-…"
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide the key" : "Show the key"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
          Model
          <select className="h-9 rounded-[10px] bg-well px-3 text-[13px] text-text shadow-[var(--press-sm)] outline-none focus-visible:shadow-[var(--press-sm),0_0_0_2px_var(--accent)]">
            {p.models?.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid items-end gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
          Base URL {p.needsBaseUrl ? "(required)" : "(advanced, optional)"}
          <Input placeholder={p.baseUrlPlaceholder || "https://…"} className="font-mono" />
        </label>
        <p className="text-[12.5px] text-muted">Your key is stored only on this computer, encrypted.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px]">
          {status === "testing" && <span className="text-muted">Testing…</span>}
          {status === "passed" && <span className="text-ok">✓ Test passed · replied in 0.9 s · you can save now</span>}
          {status === "idle" && <span className="text-faint">Add a key, then test the connection.</span>}
        </span>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn" onClick={() => setKey("")}>
            Remove key
          </button>
          <button type="button" className="btn" onClick={test}>
            Test connection
          </button>
          <button type="button" className="btn !bg-accent !text-accent-ink font-semibold">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({ p, open, onToggle }: { p: Provider; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 border-t border-line px-5 py-4 text-left transition-colors hover:bg-well/40">
        <ChevronRight size={16} aria-hidden className={cn("flex-none text-muted transition-transform", open && "rotate-90")} />
        <span className="grid size-8 flex-none place-items-center rounded-[8px] bg-well font-mono text-[12px] font-semibold text-accent shadow-[var(--press-sm)]" aria-hidden>
          {p.mark}
        </span>
        <span className="flex-none text-[14px] font-semibold">{p.name}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{p.desc}</span>
        <StateBadge state={p.state} />
        {p.keyUrl ? (
          <a
            href={p.keyUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="link flex-none"
          >
            Get key
            <ExternalLink size={13} aria-hidden />
          </a>
        ) : (
          <span className="flex-none text-[12.5px] text-muted">Needs base URL</span>
        )}
      </button>
      {open && <ProviderPanel p={p} />}
    </div>
  );
}

export function AiModels() {
  const [open, setOpen] = useState("deepseek"); // the connected one is expanded, as in the mockup
  return (
    <section className="card !gap-0 !p-0">
      <header className="flex flex-col gap-1 p-5">
        <h2 className="text-[15.5px] font-semibold">Models</h2>
        <p className="text-[13px] text-muted">Reconix model is the default. Add your own API key to use another model, then pick it in the AI Assistant.</p>
      </header>

      {/* the built-in default, always ready */}
      <div className="flex items-center gap-4 border-t border-line px-5 py-4">
        <span className="w-4 flex-none" aria-hidden />
        <span className="grid size-8 flex-none place-items-center rounded-[8px] bg-accent-wash text-accent shadow-[var(--press-sm)]" aria-hidden>
          <Diamond size={15} />
        </span>
        <span className="flex-none text-[14px] font-semibold">Reconix model</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">Built in · runs locally · tuned for security testing · no API key needed</span>
        <span className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">Default</span>
        <Badge tone="ok">
          <Check size={11} aria-hidden /> Ready
        </Badge>
      </div>

      {PROVIDERS.map((p) => (
        <ProviderRow key={p.id} p={p} open={open === p.id} onToggle={() => setOpen((cur) => (cur === p.id ? "" : p.id))} />
      ))}
    </section>
  );
}
