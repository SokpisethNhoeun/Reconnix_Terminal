/* The AI Assistant's saved conversations (server only): plain files the dashboard's own server
   writes, in ~/.reconix/assistant/ (RECONIX_ASSISTANT_DIR moves it, e.g. for tests). The folder
   is the owner's only (0700), with one <id>.json per conversation (0600). It is the only thing
   the dashboard writes: never an assessment or anything the TUI reads.

   Writing is atomic: a new temporary file (O_EXCL, never following a symlink), then a rename
   over the old one. Reading opens without following symlinks and checks through the handle: a
   regular file, at most 1 MB, then the zod schema and that the id matches the file name.
   Questions are masked before they are saved (redact.ts). Old conversations are pruned on
   every list and every write: after RECONIX_ASSISTANT_RETENTION_DAYS without use (default 30;
   0 keeps them), beyond the newest MAX_CONVERSATIONS, and messages beyond the newest
   MAX_CONVERSATION_MESSAGES. One queue serializes this process's changes. */
import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { chmod, constants, lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  AUTO_TITLE,
  cleanTitle,
  type Conversation,
  CONVERSATION_FORMAT,
  type ConversationSummary,
  ConversationSchema,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATIONS,
  MAX_FILE_BYTES,
  MAX_SAVED_REPLY,
  MAX_TITLE,
  type ReplyMessage,
  RETENTION_DAYS,
  type StoredMessage,
  summaryOf,
  type UserMessage,
} from "./history-schema";
import { isConversationId, type ScopeRef } from "./protocol";
import { redact } from "./redact";

/** Something about the folder or a file the store refuses (the route says so). */
export class HistoryError extends Error {}

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/;
const TEMP = /^\.[0-9a-f-]{36}\.[0-9a-f]{12}\.tmp$/;
const TEMP_STALE_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const MAX_NAMES = 2_000; // a folder stuffed with other files is not read further
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const WRITE_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);

export function historyDir(env: Record<string, string | undefined> = process.env): string {
  const configured = env.RECONIX_ASSISTANT_DIR?.trim();
  if (!configured) return path.join(homedir(), ".reconix", "assistant");
  const expanded = configured.startsWith("~/") ? path.join(homedir(), configured.slice(2)) : configured;
  return path.resolve(expanded);
}

/** Days a conversation is kept without use (0: kept until deleted). */
export function retentionDays(env: Record<string, string | undefined> = process.env): number {
  const raw = env.RECONIX_ASSISTANT_RETENTION_DAYS?.trim();
  const days = raw ? Number(raw) : NaN;
  return Number.isFinite(days) && days >= 0 ? days : RETENTION_DAYS;
}

// --- one queue for every change ------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

// --- the folder and the files ----------------------------------------------------------------

/** The folder, made if missing (0700); refused when it is a symlink, not a folder, or someone
    else's. Group/other permissions found on it are taken away. */
async function folder(): Promise<string> {
  const dir = historyDir();
  try {
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true, mode: 0o700 });
  } catch {
    throw new HistoryError("The conversation folder could not be created.");
  }
  const info = await lstat(/*turbopackIgnore: true*/ dir);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new HistoryError("The conversation folder is not a plain folder.");
  if (process.platform !== "win32") {
    if (typeof process.getuid === "function" && info.uid !== process.getuid()) throw new HistoryError("The conversation folder belongs to another user.");
    if ((info.mode & 0o077) !== 0) await chmod(/*turbopackIgnore: true*/ dir, 0o700);
  }
  return dir;
}

const fileOf = (dir: string, id: string) => path.join(dir, `${id}.json`);

/** A file's text through one handle that never follows a symlink, or null (missing, not a
    regular file, over 1 MB, changing). */
async function readText(full: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(/*turbopackIgnore: true*/ full, READ_FLAGS);
  } catch {
    return null; // missing, or a symlink (ELOOP)
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_FILE_BYTES) return null;
    const buffer = Buffer.alloc(info.size + 1);
    let filled = 0;
    while (filled < buffer.length) {
      const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, filled);
      if (!bytesRead) break;
      filled += bytesRead;
    }
    return filled > info.size ? null : buffer.subarray(0, filled).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function readFrom(dir: string, id: string): Promise<Conversation | null> {
  const text = await readText(fileOf(dir, id));
  if (text === null) return null;
  try {
    const parsed = ConversationSchema.safeParse(JSON.parse(text));
    return parsed.success && parsed.data.id === id ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Keeps a conversation within its limits: the newest messages, and under the file size. */
export function fit(c: Conversation): Conversation {
  let messages = c.messages.slice(-MAX_CONVERSATION_MESSAGES);
  const trimStart = () => {
    while (messages.length && messages[0].role === "assistant") messages = messages.slice(1); // a reply without its question
  };
  trimStart();
  let out = { ...c, messages };
  while (Buffer.byteLength(JSON.stringify(out)) > MAX_FILE_BYTES - 1_024 && messages.length > 1) {
    messages = messages.slice(1);
    trimStart();
    out = { ...c, messages };
  }
  return out;
}

async function writeTo(dir: string, c: Conversation): Promise<void> {
  const data = JSON.stringify(ConversationSchema.parse(fit(c)));
  const tmp = path.join(dir, `.${c.id}.${randomBytes(6).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(/*turbopackIgnore: true*/ tmp, WRITE_FLAGS, 0o600);
  } catch {
    throw new HistoryError("The conversation could not be saved.");
  }
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } catch {
    await handle.close().catch(() => {});
    await unlink(tmp).catch(() => {});
    throw new HistoryError("The conversation could not be saved.");
  }
  await handle.close();
  try {
    await rename(tmp, fileOf(dir, c.id)); // replaces a link at that name, never writes through it
  } catch {
    await unlink(tmp).catch(() => {});
    throw new HistoryError("The conversation could not be saved.");
  }
}

const expired = (c: Conversation, now: number, days: number) => days > 0 && now - c.updatedAt > days * DAY_MS;

/** Deletes what retention says goes and returns what stays, newest first. */
async function prune(dir: string, now: number): Promise<Conversation[]> {
  const names = (await readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[])).slice(0, MAX_NAMES);
  const days = retentionDays();
  const kept: Conversation[] = [];
  for (const name of names) {
    if (TEMP.test(name)) {
      // a write that never finished (the process died): gone after a while
      const info = await lstat(path.join(dir, name)).catch(() => null);
      if (info && now - info.mtimeMs > TEMP_STALE_MS) await unlink(path.join(dir, name)).catch(() => {});
      continue;
    }
    const id = FILE.exec(name)?.[1];
    if (!id) continue;
    const c = await readFrom(dir, id);
    if (!c) continue; // not one of ours, or unreadable: left alone, never listed
    if (expired(c, now, days)) await unlink(fileOf(dir, id)).catch(() => {});
    else kept.push(c);
  }
  kept.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
  for (const old of kept.splice(MAX_CONVERSATIONS)) await unlink(fileOf(dir, old.id)).catch(() => {});
  return kept;
}

// --- what the routes use -----------------------------------------------------------------------

/** Every conversation kept, newest first (pruned first). */
export function listConversations(now: number = Date.now()): Promise<ConversationSummary[]> {
  return serial(async () => (await prune(await folder(), now)).map(summaryOf));
}

/** One conversation, or null (unknown, unreadable, or past its retention). */
export async function readConversation(id: string, now: number = Date.now()): Promise<Conversation | null> {
  if (!isConversationId(id)) return null;
  const c = await readFrom(await folder(), id);
  return c && !expired(c, now, retentionDays()) ? c : null;
}

/** Saves a question (masked) in conversation `id`, or in a new one about `scope`. With `retry`,
    a last question that failed (its reply an error, or missing) is replaced. Null when `id`
    names no kept conversation. */
export function addQuestion(
  input: { id?: string; scope: ScopeRef; question: string; retry?: boolean },
  now: number = Date.now(),
): Promise<{ conversation: Conversation; asked: UserMessage } | null> {
  return serial(async () => {
    const dir = await folder();
    let c: Conversation | null = null;
    if (input.id !== undefined) {
      c = isConversationId(input.id) ? await readFrom(dir, input.id) : null;
      if (!c || expired(c, now, retentionDays())) return null;
    }
    const content = redact(input.question).trim();
    if (!c) {
      c = {
        format: CONVERSATION_FORMAT,
        id: randomUUID(),
        title: cleanTitle(content, AUTO_TITLE) || "New conversation",
        scope: input.scope,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
    }
    let messages: StoredMessage[] = c.messages;
    if (input.retry) {
      const last = messages.at(-1);
      if (last?.role === "user") messages = messages.slice(0, -1);
      else if (last?.role === "assistant" && last.state === "error") {
        messages = messages.filter((m) => m.id !== last.id && m.id !== last.replyTo);
      }
    }
    const asked: UserMessage = { id: randomUUID(), role: "user", content, at: now };
    const saved = fit({ ...c, updatedAt: now, messages: [...messages, asked] });
    await writeTo(dir, saved);
    await prune(dir, now);
    return { conversation: saved, asked };
  });
}

/** Saves the reply to question `reply.replyTo` right after it (replacing an earlier reply to
    it). Nothing happens when the conversation or the question is gone meanwhile. */
export function saveReply(id: string, reply: Omit<ReplyMessage, "id" | "role" | "at">, now: number = Date.now()): Promise<boolean> {
  return serial(async () => {
    const dir = await folder();
    const c = isConversationId(id) ? await readFrom(dir, id) : null;
    if (!c) return false;
    const others = c.messages.filter((m) => !(m.role === "assistant" && m.replyTo === reply.replyTo));
    const at = others.findIndex((m) => m.id === reply.replyTo);
    if (at < 0) return false;
    const message: ReplyMessage = {
      ...reply,
      id: randomUUID(),
      role: "assistant",
      content: redact(reply.content).slice(0, MAX_SAVED_REPLY),
      at: now,
    };
    const messages = [...others.slice(0, at + 1), message, ...others.slice(at + 1)];
    await writeTo(dir, { ...c, updatedAt: now, messages });
    await prune(dir, now);
    return true;
  });
}

/** Renames a conversation (masked, one line, at most MAX_TITLE). Null when it is gone; throws
    HistoryError when nothing is left of the title. */
export function renameConversation(id: string, title: string, now: number = Date.now()): Promise<Conversation | null> {
  return serial(async () => {
    const clean = cleanTitle(title, MAX_TITLE);
    if (!clean) throw new HistoryError("Give the conversation a name.");
    const dir = await folder();
    const c = isConversationId(id) ? await readFrom(dir, id) : null;
    if (!c) return null;
    const renamed = { ...c, title: clean, updatedAt: now };
    await writeTo(dir, renamed);
    await prune(dir, now);
    return renamed;
  });
}

/** Deletes one conversation; false when there was none. */
export function deleteConversation(id: string): Promise<boolean> {
  return serial(async () => {
    if (!isConversationId(id)) return false;
    const dir = await folder();
    try {
      await unlink(fileOf(dir, id)); // a link at that name is removed, not followed
      return true;
    } catch {
      return false;
    }
  });
}

/** Deletes every conversation (and unfinished writes); returns how many conversations went. */
export function deleteAllConversations(): Promise<number> {
  return serial(async () => {
    const dir = await folder();
    let count = 0;
    for (const name of await readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[])) {
      if (!FILE.test(name) && !TEMP.test(name)) continue;
      try {
        await unlink(path.join(dir, name));
        if (FILE.test(name)) count += 1;
      } catch {
        // already gone
      }
    }
    return count;
  });
}
