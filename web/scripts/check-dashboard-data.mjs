// Prints every value the dashboard derives from one saved assessment, to check by eye against
// the JSON file. Run from the site's folder:
//   node scripts/check-dashboard-data.mjs                  # newest file in sample-data/
//   node scripts/check-dashboard-data.mjs path/to/file.json
//   node scripts/check-dashboard-data.mjs --all [folder]   # the every-run Overview
// scripts/ts-hooks.mjs lets plain node import the TypeScript sources (no build step).
import { readdirSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { join, resolve as rpath } from "node:path";
import { pathToFileURL } from "node:url";

register("./ts-hooks.mjs", import.meta.url);
const srcUrl = pathToFileURL(rpath(process.cwd(), "src")).href;

const { deriveOverall } = await import(`${srcUrl}/components/dashboard/derive-overall.ts`);
const line = (k, v) => console.log(`  ${k.padEnd(22)} ${v}`);

if (process.argv[2] === "--all") {
  const dir = process.argv[3] ?? "sample-data";
  const { AssessmentSchema } = await import(`${srcUrl}/lib/data/schema.ts`);
  const { assessmentView } = await import(`${srcUrl}/lib/data/adapt.ts`);
  const { markIdle, STALE_AFTER_HOURS } = await import(`${srcUrl}/lib/data/stats.ts`);
  const hours = Number(process.env.RECONIX_STALE_AFTER_HOURS ?? STALE_AFTER_HOURS); // as the page reads them
  const views = readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .map((n) => AssessmentSchema.safeParse(JSON.parse(readFileSync(join(dir, n), "utf8"))))
    .filter((r) => r.success)
    .map((r) => assessmentView(markIdle(r.data, Date.now(), hours * 3_600_000)))
    .sort((a, b) => b.createdMs - a.createdMs);
  if (!views.length) {
    console.error(`${dir} holds no readable assessment.`);
    process.exit(1);
  }
  const o = deriveOverall(views);
  console.log(`\n${dir} · every run\n`);
  line("runs", `${o.runs} (${o.completed} completed, ${o.waiting} waiting)`);
  o.cards.statCards.forEach((c) => line(c.label, `${c.value} · chip "${c.chip}"`));
  line("gauge", `${o.cards.gauge.value}% · ${o.cards.gauge.caption}`);
  line("tool steps", `${o.cards.tools.used} · ${o.cards.tools.caption}`);
  line("severity", o.cards.findings.words);
  o.cards.findings.top.forEach((f) => line(f.id, `${f.score} · ${f.title} · ${f.run}`));
  line("axis", o.cards.execution.chip);
  o.statuses.forEach((s) => line(`  ${s.name}`, s.count));
  console.log();
  process.exit(0);
}

const file =
  process.argv[2] ??
  join(
    "sample-data",
    readdirSync("sample-data")
      .filter((n) => n.endsWith(".json"))
      .sort()
      .pop(),
  );
const { AssessmentSchema } = await import(`${srcUrl}/lib/data/schema.ts`);
const { assessmentView } = await import(`${srcUrl}/lib/data/adapt.ts`);
const { deriveDashboard } = await import(`${srcUrl}/components/dashboard/derive.ts`);

const parsed = AssessmentSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error(`${file} does not match the saved-assessment format.`);
  process.exit(1);
}
const d = deriveDashboard(assessmentView(parsed.data));

console.log(`\n${file}`);
console.log("\n== Assessment ==");
for (const [k, v] of Object.entries(d.assessment)) line(k, v);

console.log("\n== Findings / severity ==");
line("findingTotal", d.findingTotal);
d.severity.forEach((s) => line(s.level, `count ${s.count} · share ${s.share}% · ${s.tone}`));
line("review", `${d.cards.findings.review.confirmed} confirmed · ${d.cards.findings.review.needsReview} need review`);
d.cards.findings.top.forEach((f) => line(f.id, `${f.score} · ${f.severity} · ${f.title}`));

console.log("\n== Policy / run ==");
line("checks", `${d.checks.allowed} allowed / ${d.checks.total} (${d.checks.blocked} blocked)`);
line("maskedSecrets", d.maskedSecrets);
line("requests", d.requests);
line("minutes", `${d.minutes.used} / ${d.minutes.max ?? "no limit"}`);
line("planSteps", `${d.planSteps.done} / ${d.planSteps.total}`);
d.phases.forEach((p) => line(`  ${p.key}`, `${p.pct}% · ${p.status}`));
line("gate", d.gate ? `[${d.gate.time}] ${d.gate.text}` : "none");

console.log("\n== Timeline ==");
line("window", `${d.window.start} → ${d.window.end}`);
line("log lines", d.log.length);
line("kinds", Object.entries(Object.groupBy(d.log, (l) => l.kind)).map(([k, v]) => `${k}:${v.length}`).join(" "));
line("event bars", d.cards.activity.bars.filter((b) => b.hasEvent).length);
line("peaks", d.cards.activity.peaks.length);
line("brackets", d.cards.activity.brackets.map((b) => b.label).join(" "));
line("gauge", `${d.cards.gauge.lit} / ${d.cards.gauge.ticks}`);
line("tool steps", `${d.cards.tools.used} (bars end at ${d.cards.tools.bars.at(-1).value})`);

console.log("\n== Execution lanes ==");
d.cards.execution.lanes.forEach((l) =>
  line(l.label, l.kind === "dot" ? `dot @${l.start.toFixed(2)}` : `${l.start.toFixed(2)} → ${l.end.toFixed(2)}${l.pulse ? " (pulse)" : ""}`),
);

console.log("\n== Stat cards ==");
d.cards.statCards.forEach((c) => line(c.label, `${c.value} · chip "${c.chip}" · ${c.tone}`));
console.log();
