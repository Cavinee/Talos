import { NextResponse } from "next/server.js";

import { getCampaignRankings as _getCampaignRankings } from "../../../../lib/campaign/rankings-parser.ts";

export const runtime = "nodejs";

// Exported so tests can monkey-patch this object's method.
export const rankingsService = {
  getCampaignRankings: _getCampaignRankings,
};

export async function GET() {
  try {
    const rankings = await rankingsService.getCampaignRankings();
    return NextResponse.json({ rankings });
  } catch (error) {
    return NextResponse.json(
      {
        rankings: null,
        error: error instanceof Error ? error.message : "Failed to load rankings.",
      },
      { status: 500 },
    );
  }
}
