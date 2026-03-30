import { NextResponse } from "next/server.js";

import { campaignProcessManager } from "../../../../lib/campaign/process-manager.ts";
import { isLaunchBlocked } from "../../../../lib/campaign/types.ts";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await campaignProcessManager.launchCampaignServices();

    if (isLaunchBlocked(result)) {
      return NextResponse.json(
        {
          services: result.services,
          launchStarted: false,
          preflight: result.preflight,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ services: result });
  } catch (error) {
    return NextResponse.json(
      {
        services: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to launch campaign services.",
      },
      { status: 500 },
    );
  }
}
