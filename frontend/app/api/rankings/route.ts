import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(): Promise<NextResponse> {
  const filePath = path.join(process.cwd(), "..", "subnet", "rankings.json");

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      lastUpdated: string;
      red: unknown[];
      blue: unknown[];
    };
    return NextResponse.json({
      red: data.red ?? [],
      blue: data.blue ?? [],
      lastUpdated: data.lastUpdated ?? null,
    });
  } catch {
    return NextResponse.json({ red: [], blue: [], lastUpdated: null });
  }
}
