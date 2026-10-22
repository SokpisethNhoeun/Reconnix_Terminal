"use client";

/* The model picker: a popover that opens upward from the composer's model chip (on a phone, a
   sheet over the composer's width), in three steps: 1 "Choose a model" (your models, switched in
   one click, and the providers to add or change; model-pick.tsx), 2 "<Provider> · credentials"
   (model-credentials.tsx) and 3 "<Provider> · choose a model" (model-choose.tsx). A dialog named
   after its step; Escape goes back a step, then closes; a click outside closes it. Focus goes to
   each step's first control and back to the chip when it closes (model-chip.tsx). Its height
   fits the room above the composer (use-fit-above.ts). What was typed in step 2 lives here only
   while it is open, so Back keeps it and closing forgets it. */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { type PresetId, presetOf } from "@/lib/assistant/models/presets";
import { ModelChoose } from "./model-choose";
import { ModelCredentials } from "./model-credentials";
import { ModelPick } from "./model-pick";
import { type ChooseList, type Credentials, type ProviderRow, providerName, startCredentials } from "./model-picker-rules";
import { useFitAbove } from "./use-fit-above";
import type { Models } from "./use-models";

type Step =
  | { kind: "pick"; returnTo: string | null }
  | { kind: "credentials"; row: string; presetId: PresetId; providerId: string | null }
  | { kind: "choose"; row: string; presetId: PresetId; providerId: string | null; list: ChooseList };

interface Props {
  id: string;
  models: Models;
  chip: React.RefObject<HTMLButtonElement | null>;
  /** Closes it; `refocus`: focus goes back to the chip (not after a click elsewhere). */
  onClose: (refocus: boolean) => void;
}

export function ModelPicker({ id, models, chip, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>({ kind: "pick", returnTo: null });
  const [credentials, setCredentials] = useState<Credentials>({ baseUrl: "", apiKey: "", removeKey: false });
  useFitAbove(panel, step.kind);
  const view = models.state.view;
  const preset = step.kind === "pick" ? null : presetOf(step.presetId);
  // the saved provider the step changes, as the server last said (gone meanwhile: a new one)
  const provider = step.kind !== "pick" && step.providerId ? (view?.providers.find((p) => p.id === step.providerId) ?? null) : null;
  const title = !preset ? "Choose a model" : `${providerName(preset, provider)} · ${step.kind === "credentials" ? "credentials" : "choose a model"}`;

  const back = () => {
    if (step.kind === "choose") setStep({ kind: "credentials", row: step.row, presetId: step.presetId, providerId: step.providerId });
    else if (step.kind === "credentials") setStep({ kind: "pick", returnTo: step.row });
    else onClose(true);
  };

  // a click outside closes it; so does Escape while focus is outside it (on the chip)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !chip.current?.contains(t)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onClose(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [chip, onClose]);

  const chooseProvider = (row: ProviderRow) => {
    setCredentials(startCredentials(row.preset, row.provider));
    setStep({ kind: "credentials", row: row.key, presetId: row.preset.id, providerId: row.provider?.id ?? null });
  };

  return (
    <div
      ref={panel}
      id={id}
      role="dialog"
      aria-label={title}
      data-step={step.kind}
      className="ai-picker"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault(); // one step back (the document's listener leaves it alone)
        back();
      }}
    >
      <div className="ai-picker-head">
        <h2 className="ai-picker-title">{title}</h2>
        <IconButton label="Close" onClick={() => onClose(true)} className="size-7 [&_svg]:size-3.5">
          <X aria-hidden />
        </IconButton>
      </div>
      {step.kind === "pick" || !preset || !view ? (
        <ModelPick models={models} returnTo={step.kind === "pick" ? step.returnTo : null} onChosen={() => onClose(true)} onProvider={chooseProvider} />
      ) : step.kind === "credentials" ? (
        <ModelCredentials
          key={step.row}
          preset={preset}
          provider={provider}
          view={view}
          value={credentials}
          onChange={setCredentials}
          onBack={back}
          onNext={(list) => setStep({ ...step, kind: "choose", list })}
        />
      ) : (
        <ModelChoose
          preset={preset}
          provider={provider}
          view={view}
          credentials={credentials}
          list={step.list}
          models={models}
          onBack={back}
          onDone={() => onClose(true)}
        />
      )}
    </div>
  );
}
