/* For developers: the rules every change keeps, and the commands to run things. The
   commands sit in a terminal-colored block (dark in both themes, like the Terminal page). */
import { Check } from "lucide-react";

import { Card } from "@/components/neu/card";

import { COMMANDS, RULES } from "./content";

export function DevNotes() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card title="Rules every change keeps">
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px]">
          {RULES.map((rule) => (
            <li key={rule} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
              <Check size={15} aria-hidden className="mt-0.5 text-accent" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Run it" hint="from the repository root">
        <div className="cmd" role="group" aria-label="Commands" tabIndex={0}>
          {COMMANDS.map((c) => (
            <p key={c.cmd} className="m-0">
              <span className="cmd-note block"># {c.note}</span>
              <span className="cmd-prompt" aria-hidden>
                ${" "}
              </span>
              <code>{c.cmd}</code>
            </p>
          ))}
        </div>
        <p className="text-[12.5px] text-muted">
          In the terminal app, <code className="font-mono text-accent">/web</code> opens this dashboard (and starts it first
          if needed).
        </p>
      </Card>
    </div>
  );
}
