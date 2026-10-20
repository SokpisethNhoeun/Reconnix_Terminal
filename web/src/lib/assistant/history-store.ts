/* The AI Assistant's saved conversations (server only): plain files the dashboard's own server
   writes, in ~/.reconix/assistant/ (RECONIX_ASSISTANT_DIR moves it, e.g. for tests). The folder
   is the owner's only (0700), with one <id>.json per conversation (0600). It is the only thing
   the dashboard writes: never an assessment or anything the TUI reads.

   The folder: its parent must belong to this user (or root) and not be writable by others
   unless sticky (like /tmp); the folder itself is opened without following a link, checked
   through that handle (a directory, this user's) and tightened through it (fchmod). Before each
   write and rename it must still be the same folder (device and inode).

   Writing is atomic: a new temporary file (O_EXCL, never following a link), then a rename over
   the old one. Reading opens without following links and checks through the handle: a regular
   file, at most 1 MB, then the zod schema and that the id matches the file name. Questions are
   masked, then cut, before they are saved (redact.ts). Old conversations are pruned on every
   list and every write: after RECONIX_ASSISTANT_RETENTION_DAYS without use (default 30; 0
   keeps them; an unreadable file of ours by its last change), beyond the newest
   MAX_CONVERSATIONS, and messages beyond the newest MAX_CONVERSATION_MESSAGES. One queue (kept
   on globalThis, so every route shares it) serializes this process's changes. Errors carry
   fixed messages, never a path. */
import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { constants, type FileHandle, lstat, mkdir, open, readdir, rename, stat, unlink } from "node:fs/promises";
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
import { MAX_QUESTION } from "./request";

/** Something about the folder or a file the store refuses (the route says so). */
export class HistoryError extends Error {}

const FAIL = {
  folder: "The conversation folder could not be used.",
  plain: "The conversation folder is not a plain folder.",
  owner: "The conversation folder belongs to another user.",
  parent: "The folder that holds the conversations can be changed by other users.",
  moved: "The conversation folder changed while it was in use.",
  read: "The saved conversations could not be read.",
  save: "The conversation could not be saved.",
  delete: "The conversation could not be deleted.",
  deleteAll: "Some conversations could not be deleted.",
} as const;

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/;
const TEMP = /^\.[0-9a-f-]{36}\.[0-9a-f]{12}\.tmp$/;
const TEMP_STALE_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const MAX_NAMES = 2_000; // a folder stuffed with other files is not read further
const POSIX = process.platform !== "win32";
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const WRITE_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);
const DIR_FLAGS = constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0);

const code = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code;
const myUid = () => (POSIX && typeof process.getuid === "function" ? process.getuid() : null);

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

// --- shared by every route of this process -------------------------------------------------------

const QUEUE = Symbol.for("reconix.assistant.history.queue");
const STREAMING = Symbol.for("reconix.assistant.history.streaming");
type Shared = { [QUEUE]?: Promise<unknown>; [STREAMING]?: Set<string> };
const shared = globalThis as Shared;

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = (shared[QUEUE] ?? Promise.resolve()).then(task, task);
  shared[QUEUE] = run.catch(() => undefined);
  return run;
}

const streaming = () => (shared[STREAMING] ??= new Set<string>());

/** Marks question `id` as being answered now; call the returned function when it ends. */
export function markStreaming(id: string): () => void {
  streaming().add(id);
  return () => void streaming().delete(id);
}

// --- the folder ------------------------------------------------------------------------------

interface Folder {
  dir: string;
  handle: FileHandle | null; // null on Windows
  dev: number;
  ino: number;
}

/** The parent of the folder: this user's (or root's), not writable by others unless sticky. */
async function checkParent(dir: string): Promise<void> {
  const parent = path.dirname(dir);
  try {
    await mkdir(/*turbopackIgnore: true*/ parent, { recursive: true, mode: 0o700 });
  } catch {
    throw new HistoryError(FAIL.folder);
  }
  if (!POSIX) return;
  const info = await stat(/*turbopackIgnore: true*/ parent).catch(() => null);
  if (!info || !info.isDirectory()) throw new HistoryError(FAIL.folder);
  const uid = myUid();
  if (uid !== null && info.uid !== uid && info.uid !== 0) throw new HistoryError(FAIL.parent);
  if ((info.mode & 0o022) !== 0 && (info.mode & 0o1000) === 0) throw new HistoryError(FAIL.parent);
}

/** The folder, made if missing (0700) and opened without following a link. */
async function openFolder(): Promise<Folder> {
  const dir = historyDir();
  await checkParent(dir);
  try {
    await mkdir(/*turbopackIgnore: true*/ dir, { mode: 0o700 });
  } catch (error) {
    if (code(error) !== "EEXIST") throw new HistoryError(FAIL.folder);
  }
  if (!POSIX) {
    const info = await lstat(/*turbopackIgnore: true*/ dir).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) throw new HistoryError(FAIL.plain);
    return { dir, handle: null, dev: info.dev, ino: info.ino };
  }
  let handle: FileHandle;
  try {
    handle = await open(/*turbopackIgnore: true*/ dir, DIR_FLAGS);
  } catch (error) {
    throw new HistoryError(code(error) === "ELOOP" || code(error) === "ENOTDIR" ? FAIL.plain : FAIL.folder);
  }
  try {
    const info = await handle.stat();
    if (!info.isDirectory()) throw new HistoryError(FAIL.plain);
    const uid = myUid();
    if (uid !== null && info.uid !== uid) throw new HistoryError(FAIL.owner);
    if ((info.mode & 0o077) !== 0) await handle.chmod(0o700);
    return { dir, handle, dev: info.dev, ino: info.ino };
  } catch (error) {
    await handle.close().catch(() => {});
    throw error instanceof HistoryError ? error : new HistoryError(FAIL.folder);
  }
}

/** Throws unless the folder is still the one that was opened (not swapped, not a link). */
async function stillSame(f: Folder): Promise<void> {
  const now = await lstat(/*turbopackIgnore: true*/ f.dir).catch(() => null);
  if (!now || now.isSymbolicLink() || !now.isDirectory() || now.dev !== f.dev || now.ino !== f.ino) throw new HistoryError(FAIL.moved);
}

async function inFolder<T>(task: (f: Folder) => Promise<T>): Promise<T> {
  const f = await openFolder();
  try {
    return await task(f);
  } finally {
    await f.handle?.close().catch(() => {});
  }
}

// --- the files ---------------------------------------------------------------------------------

const fileOf = (dir: string, id: string) => path.join(dir, `${id}.json`);

/** A file's text through one handle that never follows a link, or null (missing, a link, not a
    regular file, over 1 MB, changing, unreadable). */
async function readText(full: string): Promise<string | null> {
  let handle: FileHandle;
  try {
    handle = await open(/*turbopackIgnore: true*/ full, READ_FLAGS);
  } catch {
    return null;
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
  } catch {
    return null;
  } finally {
    await handle.close().catch(() => {});
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

async function writeTo(f: Folder, c: Conversation): Promise<void> {
  const data = JSON.stringify(ConversationSchema.parse(fit(c)));
  await stillSame(f);
  const tmp = path.join(f.dir, `.${c.id}.${randomBytes(6).toString("hex")}.tmp`);
  let handle: FileHandle;
  try {
    handle = await open(/*turbopackIgnore: true*/ tmp, WRITE_FLAGS, 0o600);
  } catch {
    throw new HistoryError(FAIL.save);
  }
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
    await handle.close();
  } catch {
    await handle.close().catch(() => {});
    await unlink(tmp).catch(() => {});
    throw new HistoryError(FAIL.save);
  }
  try {
    await stillSame(f);
    await rename(tmp, fileOf(f.dir, c.id)); // replaces a link at that name, never writes through it
  } catch (error) {
    await unlink(tmp).catch(() => {});
    throw error instanceof HistoryError ? error : new HistoryError(FAIL.save);
  }
}

const expired = (updatedAt: number, now: number, days: number) => days > 0 && now - updatedAt > days * DAY_MS;

async function names(f: Folder): Promise<string[]> {
  try {
    return (await readdir(/*turbopackIgnore: true*/ f.dir)).slice(0, MAX_NAMES);
  } catch {
    throw new HistoryError(FAIL.read);
  }
}

/** Deletes what retention says goes and returns what stays, newest first. */
async function prune(f: Folder, now: number): Promise<Conversation[]> {
  const days = retentionDays();
  const uid = myUid();
  const kept: Conversation[] = [];
  for (const name of await names(f)) {
    const full = path.join(f.dir, name);
    if (TEMP.test(name)) {
      // a write that never finished (the process died): gone after a while
      const info = await lstat(full).catch(() => null);
      if (info && now - info.mtimeMs > TEMP_STALE_MS) await unlink(full).catch(() => {});
      continue;
    }
    const id = FILE.exec(name)?.[1];
    if (!id) continue;
    const c = await readFrom(f.dir, id);
    if (c) {
      if (expired(c.updatedAt, now, days)) await unlink(full).catch(() => {});
      else kept.push(c);
      continue;
    }
    // unreadable or invalid but named like ours: a regular file of this user's goes once its
    // last change is past retention (anything else is left alone, and never listed)
    const info = await lstat(full).catch(() => null);
    if (info?.isFile() && (uid === null || info.uid === uid) && expired(info.mtimeMs, now, days)) await unlink(full).catch(() => {});
  }
  kept.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
  for (const old of kept.splice(MAX_CONVERSATIONS)) await unlink(fileOf(f.dir, old.id)).catch(() => {});
  return kept;
}

/** After a write: housekeeping that never fails the write itself. */
const tidy = (f: Folder, now: number) => prune(f, now).catch(() => []);

// --- what the routes use -----------------------------------------------------------------------

/** Every conversation kept, newest first (pruned first). */
export function listConversations(now: number = Date.now()): Promise<ConversationSummary[]> {
  return serial(() => inFolder(async (f) => (await prune(f, now)).map(summaryOf)));
}

/** One conversation, or null (unknown, unreadable, or past its retention). */
export async function readConversation(id: string, now: number = Date.now()): Promise<Conversation | null> {
  if (!isConversationId(id)) return null;
  const c = await inFolder((f) => readFrom(f.dir, id));
  return c && !expired(c.updatedAt, now, retentionDays()) ? c : null;
}

/** The question as it is kept and sent: masked first, then cut, so masking never makes it too
    long. */
export const keptQuestion = (question: string) => redact(question).trim().slice(0, MAX_QUESTION);

/** Saves a question (masked, then cut) in conversation `id`, or in a new one about `scope`.
    With `retry`, the last turn is replaced only when it is this same question and it failed
    (its reply an error, or no reply); "busy" when that question is still being answered. Null
    when `id` names no kept conversation. */
export function addQuestion(
  input: { id?: string; scope: ScopeRef; question: string; retry?: boolean },
  now: number = Date.now(),
): Promise<{ conversation: Conversation; asked: UserMessage } | "busy" | null> {
  return serial(() =>
    inFolder(async (f) => {
      let c: Conversation | null = null;
      if (input.id !== undefined) {
        c = isConversationId(input.id) ? await readFrom(f.dir, input.id) : null;
        if (!c || expired(c.updatedAt, now, retentionDays())) return null;
      }
      const content = keptQuestion(input.question);
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
        if (last?.role === "user" && last.content === content) {
          if (streaming().has(last.id)) return "busy";
          messages = messages.slice(0, -1); // asked, never answered
        } else if (last?.role === "assistant" && last.state === "error") {
          const question = messages.find((m) => m.id === last.replyTo);
          if (question?.content === content) messages = messages.filter((m) => m.id !== last.id && m.id !== last.replyTo);
        }
      }
      const asked: UserMessage = { id: randomUUID(), role: "user", content, at: now };
      const saved = fit({ ...c, updatedAt: now, messages: [...messages, asked] });
      await writeTo(f, saved);
      await tidy(f, now);
      return { conversation: saved, asked };
    }),
  );
}

/** Saves the reply to question `reply.replyTo` right after it (replacing an earlier reply to
    it). False when the conversation or the question is gone meanwhile. */
export function saveReply(id: string, reply: Omit<ReplyMessage, "id" | "role" | "at">, now: number = Date.now()): Promise<boolean> {
  return serial(() =>
    inFolder(async (f) => {
      const c = isConversationId(id) ? await readFrom(f.dir, id) : null;
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
      await writeTo(f, { ...c, updatedAt: now, messages: [...others.slice(0, at + 1), message, ...others.slice(at + 1)] });
      await tidy(f, now);
      return true;
    }),
  );
}

/** Renames a conversation (masked, one line, at most MAX_TITLE). Null when it is gone; throws
    HistoryError when nothing is left of the title. */
export function renameConversation(id: string, title: string, now: number = Date.now()): Promise<Conversation | null> {
  return serial(() =>
    inFolder(async (f) => {
      const clean = cleanTitle(title, MAX_TITLE);
      if (!clean) throw new HistoryError("Give the conversation a name.");
      const c = isConversationId(id) ? await readFrom(f.dir, id) : null;
      if (!c) return null;
      const renamed = { ...c, title: clean, updatedAt: now };
      await writeTo(f, renamed);
      await tidy(f, now);
      return renamed;
    }),
  );
}

/** Deletes one conversation; false when there was none (only "no such file" means that). */
export function deleteConversation(id: string): Promise<boolean> {
  if (!isConversationId(id)) return Promise.resolve(false);
  return serial(() =>
    inFolder(async (f) => {
      await stillSame(f);
      try {
        await unlink(fileOf(f.dir, id)); // a link at that name is removed, not followed
        return true;
      } catch (error) {
        if (code(error) === "ENOENT") return false;
        throw new HistoryError(FAIL.delete);
      }
    }),
  );
}

/** Deletes every conversation (and unfinished writes); returns how many conversations went.
    Throws when any could not be deleted. */
export function deleteAllConversations(): Promise<number> {
  return serial(() =>
    inFolder(async (f) => {
      await stillSame(f);
      let count = 0;
      let failed = false;
      for (const name of await names(f)) {
        if (!FILE.test(name) && !TEMP.test(name)) continue;
        try {
          await unlink(path.join(f.dir, name));
          if (FILE.test(name)) count += 1;
        } catch (error) {
          if (code(error) !== "ENOENT") failed = true;
        }
      }
      if (failed) throw new HistoryError(FAIL.deleteAll);
      return count;
    }),
  );
}
