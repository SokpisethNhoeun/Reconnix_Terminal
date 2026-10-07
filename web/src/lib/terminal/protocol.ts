/* What travels on a terminal socket. Mirrors reconix/webterm/protocol.py.

   Binary frames are terminal bytes (keystrokes in, the TUI's output out). The helper's
   first text frame is {"type":"hello","proof"}: the page sends nothing until the proof
   matches the one that came with its ticket. The page sends text frames
   {"type":"resize","cols","rows"}. Close codes say why a session ended; the reason that
   comes with them is shown as is. */

export const CLOSE_ENDED = 4000; // the TUI exited
export const CLOSE_IDLE = 4408; // nothing typed for 30 minutes
export const CLOSE_BUSY = 4429; // two terminals already open
export const CLOSE_TOO_BIG = 1009; // a frame over the helper's limit (64 KiB)

/** Keystrokes go out in frames no bigger than this (a large paste is split). */
export const MAX_FRAME = 32 * 1024;

export const resizeMessage = (cols: number, rows: number) => JSON.stringify({ type: "resize", cols, rows });

/** The proof in a hello frame, or null for anything else. */
export function proofInHello(data: unknown): string | null {
  if (typeof data !== "string" || data.length > 256) return null;
  try {
    const message = JSON.parse(data) as { type?: unknown; proof?: unknown };
    return message?.type === "hello" && typeof message.proof === "string" ? message.proof : null;
  } catch {
    return null;
  }
}
