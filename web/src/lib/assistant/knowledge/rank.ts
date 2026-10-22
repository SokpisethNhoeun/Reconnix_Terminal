/* Ranking the knowledge passages against a question: BM25, the same as the TUI's ranker in
   Python (docs/KNOWLEDGE_OPENAPI_FINDINGS_PLAN.md §4; tests/knowledge-vectors.json, written from
   the Python side, checks both).

   Tokens: lower case, runs of [a-z0-9], at least 2 characters, minus the stopwords. BM25 with
   k1 1.2 and b 0.75, idf = ln(1 + (N − df + 0.5) / (df + 0.5)), N and the average length over
   every passage of every source; the question's tokens count once each. A passage is relevant
   at a score of 1.5 or more; the best 4 are used, ties by source name, then passage index; at
   most 4,000 characters of them go to a model (withinBudget). Pure. */

export const K1 = 1.2;
export const B = 0.75;
export const MIN_SCORE = 1.5;
export const TOP_K = 4;
export const BUDGET = 4_000; // characters of passages sent with one question
const MIN_PIECE = 200; // a passage cut to fit the budget keeps at least this much, or is left out

export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a an and are as at be but by can could did do does for from had has have how if in into is it its of on or our " +
    "should so than that the their them then there these they this to was we were what when where which who why will " +
    "with would you your"
  ).split(" "),
);

/** The tokens of `text` (see the file comment), in order, repeats kept. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** One passage: which source (its name), which of its passages (from 0), and the text. */
export interface Passage {
  source: string;
  index: number;
  text: string;
}
export interface Scored extends Passage {
  score: number;
}

interface Indexed extends Passage {
  tf: Map<string, number>;
  length: number;
}

/** Every passage tokenized once, with the document frequencies and the average length. */
export interface Corpus {
  passages: Indexed[];
  df: Map<string, number>;
  avgdl: number;
}

/** The corpus of `sources`, in their order (the order ties keep). */
export function buildCorpus(sources: { name: string; chunks: string[] }[]): Corpus {
  const passages: Indexed[] = [];
  const df = new Map<string, number>();
  let total = 0;
  for (const s of sources) {
    s.chunks.forEach((text, index) => {
      const tokens = tokenize(text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      total += tokens.length;
      passages.push({ source: s.name, index, text, tf, length: tokens.length });
    });
  }
  return { passages, df, avgdl: passages.length ? total / passages.length : 0 };
}

/** The question's tokens, each once, in the order they first appear. */
export const queryTokens = (question: string) => [...new Set(tokenize(question))];

export function idf(n: number, df: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

/** Every passage's BM25 score for `question` (0 when it shares no token), in corpus order. */
export function scoreAll(corpus: Corpus, question: string): Scored[] {
  const terms = queryTokens(question);
  const n = corpus.passages.length;
  return corpus.passages.map(({ source, index, text, tf, length }) => {
    let score = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue; // also keeps an empty passage (length 0) out of the division
      score += (idf(n, corpus.df.get(t) ?? 0) * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * length) / corpus.avgdl));
    }
    return { source, index, text, score };
  });
}

/** Compares two strings by code point, as Python does. */
function byCodePoint(a: string, b: string): number {
  if (a === b) return 0;
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

/** The relevant passages for `question`: score ≥ MIN_SCORE, best first, ties by source name,
    then passage index (then corpus order: the sort is stable), at most `top`. */
export function rank(corpus: Corpus, question: string, top: number = TOP_K): Scored[] {
  return scoreAll(corpus, question)
    .filter((p) => p.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || byCodePoint(a.source, b.source) || a.index - b.index)
    .slice(0, top);
}

/** The ranked passages that fit `budget` characters of text, in order: the first one that
    doesn't fit is cut to what is left (or left out when that is under MIN_PIECE), and nothing
    after it is sent. */
export function withinBudget<T extends Passage>(passages: T[], budget: number = BUDGET): T[] {
  const kept: T[] = [];
  let left = budget;
  for (const p of passages) {
    if (p.text.length <= left) {
      kept.push(p);
      left -= p.text.length;
      continue;
    }
    if (left >= MIN_PIECE) kept.push({ ...p, text: `${p.text.slice(0, left - 1).trimEnd()}…` });
    break;
  }
  return kept;
}
