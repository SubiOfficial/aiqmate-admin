// CLAUDE.md 5h / ADO 1597, applied to the portal (SPEC-036 FR-WEB-041): no em dash in any string
// the portal shows. Comments are out of scope, so they are stripped before the check.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("no em dash in user-facing text", () => {
  it("finds none in src", () => {
    const offenders = files(SRC).filter((f) => stripComments(readFileSync(f, "utf8")).includes("—"));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
