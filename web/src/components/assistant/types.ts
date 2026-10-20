/* What the page tells the AI Assistant (plain data from the server, see src/app/page.tsx), and
   the messages of the open conversation as the page holds them. */
import type { Status } from "@/lib/data/schema";
import type { Card, ScopeRef } from "@/lib/assistant/protocol";
import type { WelcomePrompt } from "@/lib/assistant/prompts";

export type { Card, ScopeRef, WelcomePrompt };

/** A saved run, for the scope's status badge and the report card's links. */
export interface RunSummary {
  uid: string;
  label: string; // "RCX-DEMO-001"
  when: string; // "5 Oct 14:03"
  status: Status;
}

export interface AssistantInfo {
  /** What the dashboard shows now: a new conversation is about this. */
  scope: ScopeRef & { detail: string }; // detail: "Network · 192.0.2.10" or "6 saved runs"
  runs: RunSummary[]; // every saved run, newest first
  prompts: WelcomePrompt[]; // the welcome screen's suggestions, from the data in scope
  operator: boolean; // this browser may ask the model and read the saved conversations
  terminal: boolean; // this browser may open the Terminal view
  retentionDays: number; // how long a conversation is kept without use (0: until deleted)
  model: { configured: boolean; name: string; local: boolean; reason: string };
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: Card[]; // verified cards shown with a reply (built by the server from the saved data)
  state?: "streaming" | "error" | "stopped"; // none: answered
  detail?: string; // what went wrong (state "error")
  question?: string; // the question a failed reply answers (for Retry)
};
