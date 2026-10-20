// A stand-in for an OpenAI-compatible model, for the e2e tests (playwright.config.ts starts it).
// By default it streams a short answer that names how many saved runs the system prompt
// described, how many earlier turns it was sent (the server reads them from its own file) and
// the last question, so the tests see that the route built the context and streamed the reply.
// A question with "markdown" gets a table and a code block; one with "long" gets a long answer
// that streams slowly (for Stop and "New messages").
import { createServer } from "node:http";

const port = Number(process.env.LLM_STUB_PORT || 3195);

const MARKDOWN = [
  "## Findings by severity\n\n",
  "Here is what the saved data shows:\n\n",
  "| Finding | Severity | CVSS | Where |\n",
  "|:--|:-:|--:|:--|\n",
  "| F-001 | **High** | 7.5 | `/api/v1/orders?customer_id=1042&include=payment_details,shipping_address` |\n",
  "| F-002 | Medium | 6.3 | `/api/v1/users/me/preferences/notifications/email` |\n\n",
  "Reproduce the first one:\n\n",
  "```bash\n",
  "curl -s 'https://staging.example.com/api/v1/orders?customer_id=1042&include=payment_details,shipping_address' -H 'Accept: application/json' | jq '.items[] | {id, total, customer_id}'\n",
  "```\n\n",
  "- Decide on approvals in the TUI.\n",
];

const long = () => {
  const parts = ["## A long answer\n\n"];
  for (let i = 1; i <= 40; i++) parts.push(`Paragraph ${i}: the saved data says this part of the run is described in detail, line after line, so the conversation grows taller than the screen.\n\n`);
  parts.push("The end of the long answer.");
  return parts;
};

createServer((req, res) => {
  if (req.method === "GET") return res.writeHead(200).end("stub ready");
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") return res.writeHead(404).end();
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const { messages = [] } = JSON.parse(body || "{}");
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const runs = system.match(/ALL SAVED ASSESSMENTS: (\d+)/)?.[1] ?? (system.includes("ASSESSMENT ") ? "1" : "0");
    const question = messages.at(-1)?.content ?? "";
    const earlier = messages.filter((m) => m.role !== "system").length - 1;
    const lower = question.toLowerCase();
    const words = lower.includes("markdown")
      ? MARKDOWN
      : lower.includes("long")
        ? long()
        : ["Stub answer:", ` I saw ${runs} runs.`, ` Earlier turns: ${earlier}.`, " You asked:", ` ${question}`];
    const delay = lower.includes("long") ? 90 : 40;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    let i = 0;
    const next = () => {
      if (res.destroyed) return;
      if (i < words.length) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: words[i++] } }] })}\n\n`);
        setTimeout(next, delay);
      } else res.end("data: [DONE]\n\n");
    };
    next();
  });
}).listen(port, "127.0.0.1");
