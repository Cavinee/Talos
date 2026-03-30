import { NextResponse } from "next/server.js";

import { rankingsService } from "./service.ts";

export const runtime = "nodejs";

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
