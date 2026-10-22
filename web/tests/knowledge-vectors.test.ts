/* The shared ranking vectors (tests/knowledge-vectors.json, written from the Python side, the
   TUI's /add-on ranker) checked against this ranker (lib/assistant/knowledge/rank.ts), so both
   tokenize and rank alike: the tokens of each input, and for each query the relevant passages in
   order (at least two of the query's distinct tokens, or all when it has fewer; the best 4,
   ties by source name then index) with their scores to 4
   decimals. The file arrives with the TUI's branch; until then this says so and skips. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildCorpus, rank, tokenize } from "@/lib/assistant/knowledge/rank";

interface Vectors {
  tokens: { input: string; expected: string[] }[];
  corpus: { source: string; chunks: string[] }[];
  queries: { query: string; expected: { source: string; index: number; score: number }[] }[];
}

const FILE = path.join(__dirname, "knowledge-vectors.json");
const vectors: Vectors | null = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as Vectors) : null;
const HALF = 0.5e-4 + 1e-9; // the expected scores are rounded to 4 decimals

if (!vectors) {
  it.skip("tests/knowledge-vectors.json is absent (the TUI's /add-on branch writes it): nothing to check yet", () => {});
} else {
  describe("the shared knowledge vectors", () => {
    it("has cases to check", () => {
      expect(vectors.tokens.length + vectors.queries.length).toBeGreaterThan(0);
    });

    it.each(vectors.tokens.map((t) => [JSON.stringify(t.input).slice(0, 60), t] as const))("tokenizes %s", (_, t) => {
      expect(tokenize(t.input)).toEqual(t.expected);
    });

    const corpus = buildCorpus(vectors.corpus.map((s) => ({ name: s.source, chunks: s.chunks })));
    it.each(vectors.queries.map((q) => [JSON.stringify(q.query).slice(0, 60), q] as const))("ranks %s", (_, q) => {
      const got = rank(corpus, q.query);
      expect(got.map((p) => [p.source, p.index])).toEqual(q.expected.map((e) => [e.source, e.index]));
      got.forEach((p, i) => expect(Math.abs(p.score - q.expected[i].score), `${p.source} #${p.index}`).toBeLessThanOrEqual(HALF));
    });
  });
}
