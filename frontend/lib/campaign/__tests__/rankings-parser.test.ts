import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCampaignRankings } from "../rankings-parser.ts";

// ANSI color codes present in real validator logs
const ANSI_RESET = "\x1b[0m";
const ANSI_BLUE = "\x1b[34m";
const ANSI_RESET2 = "\x1b[39m";
const ANSI_BOLD_WHITE = "\x1b[1m\x1b[37m";
const ANSI_RESET3 = "\x1b[39m\x1b[49m";

function makeLogLine(level: string, message: string): string {
  return `${ANSI_BLUE}2026-03-30 11:45:51.383${ANSI_RESET2} | ${ANSI_BOLD_WHITE}  ${level}  ${ANSI_RESET3}${ANSI_RESET} | bittensor:validator.py:383 | ${message}`;
}

function makeRealisticLog(opts: {
  epochLines?: string[];
  uidLines?: string[];
  weightsLine?: string;
  completionSentinel?: boolean;
}): string {
  const lines: string[] = [];

  for (const line of opts.epochLines ?? []) {
    lines.push(makeLogLine("INFO", line));
  }

  for (const line of opts.uidLines ?? []) {
    lines.push(makeLogLine("INFO", line));
  }

  if (opts.weightsLine) {
    lines.push(makeLogLine("INFO", opts.weightsLine));
  }

  if (opts.completionSentinel) {
    lines.push(makeLogLine("SUCCESS", "All epochs complete. Validator exiting."));
  }

  return lines.join("\n") + "\n";
}

async function withTempDir(
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rankings-parser-test-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 1: Empty directory → empty rankings
// ---------------------------------------------------------------------------
test("empty directory returns empty rankings", async () => {
  await withTempDir(async (dir) => {
    const result = await parseCampaignRankings(dir);

    assert.deepEqual(result.red, []);
    assert.deepEqual(result.blue, []);
    assert.equal(result.lastUpdatedAt, null);
    assert.equal(result.validatorsCompleted, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Nonexistent directory → empty rankings
// ---------------------------------------------------------------------------
test("nonexistent directory returns empty rankings", async () => {
  const result = await parseCampaignRankings("/tmp/does-not-exist-" + Date.now());
  assert.deepEqual(result.red, []);
  assert.deepEqual(result.blue, []);
  assert.equal(result.lastUpdatedAt, null);
  assert.equal(result.validatorsCompleted, 0);
});

// ---------------------------------------------------------------------------
// Test 3: Single validator log with complete data → correct rankings
// ---------------------------------------------------------------------------
test("single validator log produces correct red and blue rankings", async () => {
  await withTempDir(async (dir) => {
    const content = makeRealisticLog({
      epochLines: [
        "Epoch 10 scores - Red 4: 0.2000, Blue 10: 0.6667",
      ],
      uidLines: [
        "UID 4: avg_score=0.2000 (from 2 epochs)",
        "UID 5: avg_score=0.0250 (from 2 epochs)",
        "UID 9: avg_score=0.9615 (from 2 epochs)",
        "UID 10: avg_score=0.6667 (from 2 epochs)",
      ],
      weightsLine:
        "Setting weights: UIDs=[4, 5, 9, 10], Weights=[0.065, 0.008, 0.314, 0.218]",
      completionSentinel: true,
    });

    await fs.writeFile(path.join(dir, "validator_1.log"), content, "utf8");

    const result = await parseCampaignRankings(dir);

    // UID 4 is Red, UID 10 is Blue (from epoch line)
    // UIDs 5 and 9 have no role mapping → should not appear
    assert.equal(result.red.length, 1);
    assert.equal(result.blue.length, 1);

    const red4 = result.red[0];
    assert.ok(red4, "red4 should exist");
    assert.equal(red4.uid, 4);
    assert.equal(red4.role, "red");
    assert.equal(red4.rank, 1);
    assert.equal(red4.validatorKey, "validator_1");
    // avgScore close to 0.2
    assert.ok(Math.abs(red4.avgScore - 0.2) < 0.001);
    // normalizedWeight for UID 4 is 0.065
    assert.ok(Math.abs(red4.normalizedWeight - 0.065) < 0.001);

    const blue10 = result.blue[0];
    assert.ok(blue10, "blue10 should exist");
    assert.equal(blue10.uid, 10);
    assert.equal(blue10.role, "blue");
    assert.equal(blue10.rank, 1);
    assert.equal(blue10.validatorKey, "validator_1");
    assert.ok(Math.abs(blue10.avgScore - 0.6667) < 0.001);
    assert.ok(Math.abs(blue10.normalizedWeight - 0.218) < 0.001);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Multiple validators, overlapping UIDs → later file wins
// ---------------------------------------------------------------------------
test("later validator file wins for overlapping UIDs", async () => {
  await withTempDir(async (dir) => {
    const olderContent = makeRealisticLog({
      epochLines: ["Epoch 1 scores - Red 4: 0.1000, Blue 10: 0.3000"],
      uidLines: [
        "UID 4: avg_score=0.1000 (from 1 epochs)",
        "UID 10: avg_score=0.3000 (from 1 epochs)",
      ],
      weightsLine:
        "Setting weights: UIDs=[4, 10], Weights=[0.100, 0.300]",
    });

    const newerContent = makeRealisticLog({
      epochLines: ["Epoch 2 scores - Red 4: 0.9000, Blue 10: 0.8000"],
      uidLines: [
        "UID 4: avg_score=0.9000 (from 2 epochs)",
        "UID 10: avg_score=0.8000 (from 2 epochs)",
      ],
      weightsLine:
        "Setting weights: UIDs=[4, 10], Weights=[0.900, 0.800]",
    });

    const olderPath = path.join(dir, "validator_1.log");
    const newerPath = path.join(dir, "validator_2.log");

    await fs.writeFile(olderPath, olderContent, "utf8");
    await fs.writeFile(newerPath, newerContent, "utf8");

    // Backdate the older file by 2 seconds so mtime ordering is deterministic
    // regardless of filesystem resolution or write timing.
    const twoSecondsAgo = (Date.now() - 2000) / 1000;
    await fs.utimes(olderPath, twoSecondsAgo, twoSecondsAgo);

    const result = await parseCampaignRankings(dir);

    const red4 = result.red.find((m) => m.uid === 4);
    const blue10 = result.blue.find((m) => m.uid === 10);

    assert.ok(red4, "red4 must be present");
    assert.ok(Math.abs(red4.avgScore - 0.9) < 0.001, "newer file should win (0.9)");
    assert.equal(red4.validatorKey, "validator_2");

    assert.ok(blue10, "blue10 must be present");
    assert.ok(Math.abs(blue10.avgScore - 0.8) < 0.001, "newer file should win (0.8)");
    assert.equal(blue10.validatorKey, "validator_2");
  });
});

// ---------------------------------------------------------------------------
// Test 4: No completion sentinel → validatorsCompleted is 0
// ---------------------------------------------------------------------------
test("log without completion sentinel yields validatorsCompleted=0", async () => {
  await withTempDir(async (dir) => {
    const content = makeRealisticLog({
      epochLines: ["Epoch 1 scores - Red 4: 0.5000, Blue 10: 0.5000"],
      uidLines: [
        "UID 4: avg_score=0.5000 (from 1 epochs)",
        "UID 10: avg_score=0.5000 (from 1 epochs)",
      ],
      weightsLine: "Setting weights: UIDs=[4, 10], Weights=[0.5, 0.5]",
      completionSentinel: false,
    });

    await fs.writeFile(path.join(dir, "validator_1.log"), content, "utf8");

    const result = await parseCampaignRankings(dir);

    assert.equal(result.validatorsCompleted, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Log with completion sentinel → validatorsCompleted is 1
// ---------------------------------------------------------------------------
test("log with completion sentinel yields validatorsCompleted=1", async () => {
  await withTempDir(async (dir) => {
    const content = makeRealisticLog({
      epochLines: ["Epoch 1 scores - Red 4: 0.5000, Blue 10: 0.5000"],
      uidLines: [
        "UID 4: avg_score=0.5000 (from 1 epochs)",
        "UID 10: avg_score=0.5000 (from 1 epochs)",
      ],
      weightsLine: "Setting weights: UIDs=[4, 10], Weights=[0.5, 0.5]",
      completionSentinel: true,
    });

    await fs.writeFile(path.join(dir, "validator_1.log"), content, "utf8");

    const result = await parseCampaignRankings(dir);

    assert.equal(result.validatorsCompleted, 1);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Partial log (only role mapping, no avg_score) → empty rankings
// ---------------------------------------------------------------------------
test("partial log with only role mapping but no avg_score yields empty rankings", async () => {
  await withTempDir(async (dir) => {
    const content = makeRealisticLog({
      epochLines: [
        "Epoch 1 scores - Red 4: 0.5000, Blue 10: 0.5000",
      ],
      // No uidLines, no weightsLine
    });

    await fs.writeFile(path.join(dir, "validator_1.log"), content, "utf8");

    const result = await parseCampaignRankings(dir);

    assert.deepEqual(result.red, []);
    assert.deepEqual(result.blue, []);
  });
});

// ---------------------------------------------------------------------------
// Extra: rank assignment is correct for multiple miners per role
// ---------------------------------------------------------------------------
test("ranks are assigned 1-indexed descending by avgScore within role", async () => {
  await withTempDir(async (dir) => {
    const content = makeRealisticLog({
      epochLines: [
        "Epoch 1 scores - Red 4: 0.3000, Blue 10: 0.9000",
        "Epoch 1 scores - Red 5: 0.7000, Blue 11: 0.4000",
      ],
      uidLines: [
        "UID 4: avg_score=0.3000 (from 1 epochs)",
        "UID 5: avg_score=0.7000 (from 1 epochs)",
        "UID 10: avg_score=0.9000 (from 1 epochs)",
        "UID 11: avg_score=0.4000 (from 1 epochs)",
      ],
      weightsLine:
        "Setting weights: UIDs=[4, 5, 10, 11], Weights=[0.1, 0.3, 0.4, 0.2]",
    });

    await fs.writeFile(path.join(dir, "validator_1.log"), content, "utf8");

    const result = await parseCampaignRankings(dir);

    // Red: UID 5 (0.7) rank 1, UID 4 (0.3) rank 2
    const redByUid = Object.fromEntries(result.red.map((m) => [m.uid, m]));
    assert.equal(redByUid[5]?.rank, 1);
    assert.equal(redByUid[4]?.rank, 2);

    // Blue: UID 10 (0.9) rank 1, UID 11 (0.4) rank 2
    const blueByUid = Object.fromEntries(result.blue.map((m) => [m.uid, m]));
    assert.equal(blueByUid[10]?.rank, 1);
    assert.equal(blueByUid[11]?.rank, 2);
  });
});
