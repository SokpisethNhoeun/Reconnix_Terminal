/* The sample assessments (written by scripts/make_sample_data.py) as test fixtures. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { type Assessment, AssessmentSchema } from "@/lib/data/schema";

export const SAMPLE_DIR = path.join(__dirname, "..", "sample-data");

export function sampleNames(): string[] {
  return readdirSync(SAMPLE_DIR).filter((n) => n.endsWith(".json")).sort();
}

export function sampleAssessments(): Assessment[] {
  return sampleNames().map((n) => AssessmentSchema.parse(JSON.parse(readFileSync(path.join(SAMPLE_DIR, n), "utf8"))));
}
