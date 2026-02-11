import dns from "node:dns/promises";

dns.setServers(["1.1.1.1"]);
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Institution } from "@/lib/models";

export async function GET() {
  await dbConnect();
  const list = await Institution.find({ isActive: true }).select("_id displayName code logoUrl").sort({ displayName: 1 });
  return NextResponse.json(list);
}

// Houses (Red, Blue, Green) are fixed — use seed script to create them; no adding via API
export async function POST() {
  return NextResponse.json({ error: "Houses are fixed (Red, Blue, Green). Run: npm run seed" }, { status: 405 });
}