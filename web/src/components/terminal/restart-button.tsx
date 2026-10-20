"use client";

/* Restart session. While a session is live it asks first, because restarting ends the
   terminal app running here (and any run still going in it); "Keep this session" is the
   first choice. With no live session it restarts straight away. (Adapted from
   reconix-tui/web: the confirmation uses this site's Popover.) */
import { RotateCcw } from "lucide-react";

import { Popover } from "@/components/dashboard/popover";
import { IconButton } from "@/components/ui/icon-button";

interface Props {
  live: boolean;
  disabled: boolean;
  onRestart: () => void;
  onDone: () => void; // closed without a restart: put the keyboard back in the terminal
}

const LABEL = "Restart session";
const TRIGGER =
  "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted [&_svg]:size-4";
const CHOICE =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RestartButton({ live, disabled, onRestart, onDone }: Props) {
  if (!live) {
    return (
      <IconButton label={LABEL} disabled={disabled} onClick={onRestart}>
        <RotateCcw aria-hidden />
      </IconButton>
    );
  }
  return (
    <Popover triggerAriaLabel={LABEL} triggerClassName={TRIGGER} align="end" panelClassName="w-64 p-2" triggerContent={<RotateCcw aria-hidden />}>
      {(close) => (
        <>
          <p className="px-2 pt-1 text-[13px] font-medium text-foreground">Restart this session?</p>
          <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">It ends the terminal app running here. A run that is still going stops.</p>
          <button
            type="button"
            className={`${CHOICE} text-foreground`}
            onClick={() => {
              close();
              onDone();
            }}
            autoFocus
          >
            Keep this session
          </button>
          <button
            type="button"
            className={`${CHOICE} text-danger`}
            onClick={() => {
              close();
              onRestart();
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Restart
          </button>
        </>
      )}
    </Popover>
  );
}
