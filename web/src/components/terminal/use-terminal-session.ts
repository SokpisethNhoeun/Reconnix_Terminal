"use client";

/* One session on the terminal helper: get a ticket, open the socket, check the helper's
   hello, pump bytes both ways, and say why it ended. Nothing is sent or shown before the
   hello matches, so whatever else might sit on the helper's port gets no keystrokes.
   `restart()` opens a new session (closing the socket stops the old TUI). Keystrokes go
   out as binary frames, sizes as text frames (lib/terminal/protocol). */
import type { IDisposable, Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useState } from "react";

import { TICKET_ROUTE } from "@/lib/terminal/paths";
import { CLOSE_BUSY, CLOSE_ENDED, CLOSE_IDLE, CLOSE_TOO_BIG, MAX_FRAME, proofInHello, resizeMessage } from "@/lib/terminal/protocol";

export type SessionState = "connecting" | "connected" | "ended" | "failed";

const UNREACHABLE =
  "Couldn't open a session. Try New session. If that fails too, the terminal service isn't running: it starts with " +
  "the dashboard (npm run dev / npm start) and needs Python with the packages from requirements.txt, on Linux or " +
  "macOS. The dashboard's output says what went wrong.";
const EXPIRED = "Your sign-in has expired. Open the dashboard's sign-in link again.";
const IMPOSTOR =
  "Something other than the Reconix terminal service answered on its port, so nothing was sent to it. " +
  "Stop whatever else uses that port, then restart the dashboard.";
const HELLO_WAIT_MS = 5_000;

export function useTerminalSession(terminal: Terminal | null) {
  const [state, setState] = useState<SessionState>("connecting");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!terminal) return;
    const term = terminal;
    const encoder = new TextEncoder();
    const subscriptions: IDisposable[] = [];
    let socket: WebSocket | null = null;
    let left = false; // this session was replaced or unmounted: stay quiet
    let verified = false; // the helper's hello matched
    let helloTimer = 0;
    const finish = (next: SessionState, text: string) => {
      if (left) return;
      setState(next);
      setMessage(text);
    };

    term.reset();
    void (async () => {
      const res = await fetch(TICKET_ROUTE, { method: "POST" }).catch(() => null);
      const body: unknown = res ? await res.json().catch(() => null) : null;
      if (left) return;
      if (!res?.ok || !isTicket(body)) {
        finish("failed", res?.status === 401 ? EXPIRED : (detailOf(body) ?? UNREACHABLE));
        return;
      }
      const ws = new WebSocket(`${body.url}?ticket=${encodeURIComponent(body.ticket)}`);
      socket = ws;
      ws.binaryType = "arraybuffer";
      const refuse = (text: string) => {
        finish("failed", text);
        left = true; // its close event must not replace this message
        ws.close(1000);
      };
      const send = (data: string | Uint8Array<ArrayBuffer>) => {
        if (!verified || ws.readyState !== WebSocket.OPEN) return;
        if (typeof data === "string" || data.length <= MAX_FRAME) ws.send(data);
        else for (let at = 0; at < data.length; at += MAX_FRAME) ws.send(data.subarray(at, at + MAX_FRAME));
      };
      ws.onopen = () => {
        helloTimer = window.setTimeout(() => refuse(IMPOSTOR), HELLO_WAIT_MS);
      };
      ws.onmessage = (event) => {
        if (verified) {
          if (event.data instanceof ArrayBuffer) term.write(new Uint8Array(event.data));
          return;
        }
        window.clearTimeout(helloTimer);
        if (proofInHello(event.data) !== body.proof) {
          refuse(IMPOSTOR);
          return;
        }
        verified = true;
        send(resizeMessage(term.cols, term.rows));
        finish("connected", "");
        term.focus();
      };
      ws.onclose = (event) => finish(event.code === CLOSE_ENDED || event.code === CLOSE_IDLE ? "ended" : "failed", closeMessage(event));
      subscriptions.push(
        term.onData((data) => send(encoder.encode(data))),
        term.onBinary((data) => send(Uint8Array.from(data, (c) => c.charCodeAt(0) & 0xff))),
        term.onResize(({ cols, rows }) => send(resizeMessage(cols, rows))),
      );
    })();

    return () => {
      left = true;
      window.clearTimeout(helloTimer);
      subscriptions.forEach((s) => s.dispose());
      socket?.close(1000);
    };
  }, [terminal, attempt]);

  const restart = useCallback(() => {
    setState("connecting");
    setMessage("");
    setAttempt((n) => n + 1);
  }, []);

  return { state, message, restart };
}

function isTicket(body: unknown): body is { ticket: string; proof: string; url: string } {
  const b = body as { ticket?: unknown; proof?: unknown; url?: unknown } | null;
  return typeof b?.ticket === "string" && typeof b.proof === "string" && typeof b.url === "string" && b.url.startsWith("ws://127.0.0.1:");
}

function detailOf(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : undefined;
}

function closeMessage(event: CloseEvent): string {
  if ([CLOSE_ENDED, CLOSE_IDLE, CLOSE_BUSY].includes(event.code)) return event.reason || "The session ended.";
  if (event.code === CLOSE_TOO_BIG) return "That was too much to send at once, so the session closed. Start a new one.";
  if (event.code === 1000 || event.code === 1001) return "The terminal service closed the session.";
  return UNREACHABLE;
}
