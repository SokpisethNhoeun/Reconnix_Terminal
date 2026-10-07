"use client";

/* Restart session. While a session is live it asks first, because restarting ends the
   terminal app running here (and any run still going in it); "Keep this session" is the
   first, highlighted choice. With no live session it restarts straight away. */
import { RotateCcw } from "lucide-react";

import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface Props {
  live: boolean;
  disabled: boolean;
  onRestart: () => void;
  onClose: () => void; // the menu closed without a restart: back to the terminal
}

const LABEL = "Restart session";

export function RestartButton({ live, disabled, onRestart, onClose }: Props) {
  if (!live) {
    return (
      <Button variant="quiet" size="icon-sm" aria-label={LABEL} title={LABEL} disabled={disabled} onClick={onRestart}>
        <RotateCcw aria-hidden />
      </Button>
    );
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon-sm" aria-label={LABEL} title={LABEL}>
          <RotateCcw aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <DropdownMenuLabel>Restart this session?</DropdownMenuLabel>
        <p className="px-2.5 pb-2 text-[12.5px] text-muted">It ends the terminal app running here. A run that is still going stops.</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Keep this session</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRestart}>
          <RotateCcw aria-hidden />
          Restart
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
