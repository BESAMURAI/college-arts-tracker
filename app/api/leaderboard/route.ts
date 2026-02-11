import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getLeaderboard } from "@/lib/leaderboard";

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") as "high_school" | "higher_secondary" | null;
  const data = await getLeaderboard(20, level || undefined);
  return NextResponse.json({ data, updatedAt: new Date().toISOString() });
}
