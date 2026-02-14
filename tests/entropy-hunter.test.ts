/**
 * FLARE STACK — Entropy Hunter Tests
 *
 * Tests mutation generation operators — does NOT run subprocesses.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  generateMutations,
  type Mutation,
} from "../src/quality/entropy-hunter.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Entropy Hunter — Mutation Generation", () => {
  const testDir = join(tmpdir(), "flare-entropy-test-" + Date.now());
  const testFile = join(testDir, "sample.ts");

  const sampleCode = `
import { something } from "lib";

export function isValid(input: string): boolean {
  if (input.length === 0) {
    return false;
  }
  return true;
}

export function calculate(a: number, b: number): number {
  const sum = a + b;
  if (sum > 100) {
    return sum * 2;
  }
  return sum;
}
`;

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testFile, sampleCode);
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should generate mutations from source file", async () => {
    const mutations = await generateMutations(testFile, 50);
    expect(mutations.length).toBeGreaterThan(0);
  });

  it("should generate negate-return mutations", async () => {
    const mutations = await generateMutations(testFile, 50);
    const negateReturns = mutations.filter((m) => m.type === "negate-return");
    expect(negateReturns.length).toBeGreaterThan(0);

    // "return false" should be mutated to "return true"
    const falseMutation = negateReturns.find((m) =>
      m.original.includes("return false"),
    );
    expect(falseMutation).toBeDefined();
    expect(falseMutation!.mutated).toContain("return true");
  });

  it("should generate swap-comparison mutations", async () => {
    const mutations = await generateMutations(testFile, 50);
    const swaps = mutations.filter((m) => m.type === "swap-comparison");
    expect(swaps.length).toBeGreaterThan(0);
  });

  it("should generate swap-arithmetic mutations", async () => {
    const mutations = await generateMutations(testFile, 50);
    const arith = mutations.filter((m) => m.type === "swap-arithmetic");
    expect(arith.length).toBeGreaterThan(0);

    // "a + b" should become "a - b"
    const plusMutation = arith.find((m) => m.original.includes("+"));
    expect(plusMutation).toBeDefined();
    expect(plusMutation!.mutated).toContain("-");
  });

  it("should respect maxMutations limit", async () => {
    const mutations = await generateMutations(testFile, 3);
    expect(mutations.length).toBeLessThanOrEqual(3);
  });

  it("should skip imports and comments", async () => {
    const mutations = await generateMutations(testFile, 50);
    const importMutations = mutations.filter((m) =>
      m.original.includes("import"),
    );
    expect(importMutations.length).toBe(0);
  });

  it("should set correct line numbers", async () => {
    const mutations = await generateMutations(testFile, 50);
    for (const m of mutations) {
      expect(m.line).toBeGreaterThan(0);
      expect(m.file).toBe(testFile);
    }
  });
});
