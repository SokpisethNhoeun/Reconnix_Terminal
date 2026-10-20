/* What the page tells the AI Assistant (plain data from the server, see src/app/page.tsx). */

export interface AssistantInfo {
  scope: {
    uid: string | null; // the open run, or null for every saved run
    label: string; // "RCX-DEMO-001" or "All assessments"
    detail: string; // "Network · 192.0.2.10 · Interrupted"
    chips: string[]; // a few key numbers ("30 findings", "18 blocked")
  };
  questions: string[]; // suggestions, from what the data holds
  operator: boolean; // this browser may ask the model (operator role)
  model: { configured: boolean; name: string; local: boolean; reason: string };
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  scope: string; // what was in scope when it was asked, as shown
  scopeKey: string; // the run's uid, or "all": only turns about the same scope are resent
  state?: "streaming" | "error" | "stopped";
};
