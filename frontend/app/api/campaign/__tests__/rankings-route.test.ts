import assert from "node:assert/strict";
import test from "node:test";

import { GET, rankingsService } from "../rankings/route.ts";
import type { CampaignRankings } from "../../../../lib/campaign/rankings-parser.ts";

const sampleRankings: CampaignRankings = {
  red: [
    {
      uid: 1,
      role: "red",
      avgScore: 0.9,
      normalizedWeight: 0.6,
      rank: 1,
      validatorKey: "validator_1",
    },
  ],
  blue: [
    {
      uid: 2,
      role: "blue",
      avgScore: 0.7,
      normalizedWeight: 0.4,
      rank: 1,
      validatorKey: "validator_1",
    },
  ],
  lastUpdatedAt: "2026-03-30T10:00:00.000Z",
  validatorsCompleted: 1,
};

test("GET /api/campaign/rankings returns rankings from the parser as { rankings: ... } with status 200", async () => {
  const original = rankingsService.getCampaignRankings;
  rankingsService.getCampaignRankings = async () => sampleRankings;

  try {
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { rankings: sampleRankings });
  } finally {
    rankingsService.getCampaignRankings = original;
  }
});

test("GET /api/campaign/rankings returns { rankings: null, error: '...' } with status 500 when the parser throws", async () => {
  const original = rankingsService.getCampaignRankings;
  rankingsService.getCampaignRankings = async () => {
    throw new Error("rankings lookup failed");
  };

  try {
    const response = await GET();
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(payload, {
      rankings: null,
      error: "rankings lookup failed",
    });
  } finally {
    rankingsService.getCampaignRankings = original;
  }
});
