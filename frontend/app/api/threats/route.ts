import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10));

  const filePath = path.join(process.cwd(), "..", "subnet", "threat_stream.json");

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const all: unknown[] = JSON.parse(raw);
    const threats = all.slice(-limit).reverse();
    return NextResponse.json({ threats });
  } catch {
    return NextResponse.json({ threats: [] });
  }
}
