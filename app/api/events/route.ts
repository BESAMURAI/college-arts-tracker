import dns from "node:dns/promises";

dns.setServers(["1.1.1.1"]);
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { EventModel } from "@/lib/models";

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") as "high_school" | "higher_secondary" | null;
  const query: any = { isActive: true };
  if (level) {
    query.level = level;
  }
  const list = await EventModel.find(query).select("_id name category roomCode level");
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  await dbConnect();
  try {
    const body = await req.json();
    const { name, description, category, roomCode, schedule, level } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const levelValue = level && ["high_school", "higher_secondary"].includes(level) ? level : "high_school";

    const event = await EventModel.create({
      name,
      description: description || undefined,
      category: category || undefined,
      roomCode: roomCode || undefined,
      level: levelValue,
      schedule: schedule ? {
        start: schedule.start ? new Date(schedule.start) : undefined,
        end: schedule.end ? new Date(schedule.end) : undefined
      } : undefined,
      isActive: true
    });

    return NextResponse.json({ ok: true, id: event._id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create event" }, { status: 400 });
  }
}