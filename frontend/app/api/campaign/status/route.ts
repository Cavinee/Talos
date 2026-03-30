import { NextResponse } from "next/server.js";

import { campaignProcessManager } from "../../../../lib/campaign/process-manager.ts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const services = await campaignProcessManager.getCampaignServiceSnapshot();
    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json(
      {
        services: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load campaign services.",
      },
      { status: 500 },
    );
  }
}
