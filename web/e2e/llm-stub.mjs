// A stand-in for an OpenAI-compatible model, for the e2e tests (playwright.config.ts starts it):
// it streams a short answer that names how many saved runs the system prompt described and the
// last question, so the tests see that the route built the context and streamed the reply.
import { createServer } from "node:http";

const port = Number(process.env.LLM_STUB_PORT || 3195);

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
    const words = ["Stub answer:", ` I saw ${runs} runs.`, " You asked:", ` ${question}`];
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    let i = 0;
    const next = () => {
      if (i < words.length) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: words[i++] } }] })}\n\n`);
        setTimeout(next, 40);
      } else res.end("data: [DONE]\n\n");
    };
    next();
  });
}).listen(port, "127.0.0.1");
