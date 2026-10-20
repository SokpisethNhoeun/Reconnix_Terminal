/* The Word report's content as plain blocks (title, headings, paragraphs, tables), built from
   a saved assessment. A port of reconix/store/report_docx.py, so the dashboard's DOCX matches
   the TUI's. `docx.ts` turns the blocks into the file; the preview page shows the same blocks,
   so what you check is what you download. Pure data; safe to import anywhere. */
import type { Assessment, Finding } from "@/lib/data/schema";

export type DocBlock =
  | { kind: "title" | "subtitle" | "h1" | "h2" | "p" | "quote" | "note"; text: string }
  | { kind: "table"; head: string[] | null; rows: string[][] };

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const shortDate = (iso: string | null | undefined) => (iso ? iso.split("T")[0] : "—");
const cvss = (f: Finding) => (f.cvss_score ? f.cvss_score.toFixed(1) : "—");

function summary(a: Assessment): string {
  const findings = a.findings;
  const c = Object.fromEntries(SEV_ORDER.map((s) => [s, 0])) as Record<string, number>;
  for (const f of findings) c[f.severity] += 1;
  const breakdown = SEV_ORDER.filter((s) => c[s]).map((s) => `${c[s]} ${title(s)}`).join(", ") || "no findings";
  const blocked = a.verdicts.filter((v) => !v.allowed).length;
  const approved = a.decisions.filter((d) => d.decision === "APPROVED").length;
  return (
    `Reconix performed an authorized assessment of ${a.target_url || a.target || "the target"} ` +
    `(${a.template.name || "assessment"}). It recorded ${findings.length} finding(s) — ${breakdown}. ` +
    `${blocked} out-of-scope request(s) were blocked by policy and ${approved} gated action(s) ` +
    `were approved by a human.`
  );
}

function findingBlocks(f: Finding): DocBlock[] {
  const mapping = [...f.owasp, ...f.cwe, ...f.cve].join(", ") || "—";
  const blocks: DocBlock[] = [
    { kind: "h2", text: `${f.id} · ${f.title}` },
    {
      kind: "p",
      text:
        `Severity: ${f.severity} · CVSS ${cvss(f)} · ${f.category || "—"} · ` +
        `${f.validation || "—"} · ${f.status || "open"}`,
    },
    { kind: "p", text: `Affected asset: ${f.affected_url || f.path || "—"}` },
    { kind: "p", text: f.description },
  ];
  if (f.evidence.length) blocks.push({ kind: "quote", text: f.evidence.join("\n") });
  blocks.push(
    { kind: "p", text: `Impact: ${f.impact}` },
    { kind: "p", text: `Remediation: ${f.remediation}` },
    { kind: "p", text: `Mapping: ${mapping}` },
  );
  return blocks;
}

export function docxBlocks(a: Assessment, now: Date = new Date()): DocBlock[] {
  const meta: string[][] = [
    ["Client", a.client || "—"],
    ["Engagement ID", a.assessment_id || a.label || "—"],
    ["Assessment type", a.mode || "—"],
    ["Report date", shortDate(now.toISOString())],
    ["Report version", a.report_version || "1.0"],
    ["Standards", a.methodology.join(" · ") || "—"],
  ];
  const rows = a.findings.map((f) => [f.id, f.severity, cvss(f), f.status || "open", f.category || "—", f.title]);
  return [
    { kind: "title", text: "Security Assessment Report" },
    { kind: "subtitle", text: `AI-Assisted Authorized Penetration Test — ${a.template.name || "Security assessment"}` },
    { kind: "table", head: null, rows: meta },
    { kind: "note", text: "CONFIDENTIAL — authorized recipients only." },
    { kind: "h1", text: "Executive summary" },
    { kind: "p", text: summary(a) },
    { kind: "h1", text: "Findings summary" },
    rows.length
      ? { kind: "table", head: ["ID", "Severity", "CVSS", "Status", "Category", "Finding"], rows }
      : { kind: "p", text: "No findings were recorded." },
    ...(a.findings.length ? [{ kind: "h1", text: "Detailed findings" } as DocBlock] : []),
    ...a.findings.flatMap(findingBlocks),
  ];
}
