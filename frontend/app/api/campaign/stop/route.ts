import { NextResponse } from "next/server.js";

import { campaignProcessManager } from "../../../../lib/campaign/process-manager.ts";

export const runtime = "nodejs";

export async function POST() {
  try {
    const services = await campaignProcessManager.stopCampaignServices();
    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json(
      {
        services: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to stop campaign services.",
      },
      { status: 500 },
    );
  }
}
