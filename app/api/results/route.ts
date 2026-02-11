import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Result, Totals } from "@/lib/models";
import mongoose from "mongoose";
import { broadcast } from "@/lib/sse";

type Placement = { rank: 1|2|3, studentName: string, institutionId: string, points: number };

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const { eventId, placements, submittedBy } = body as { eventId: string, placements: Placement[], submittedBy?: string };

  // Basic validation
  if (!eventId || !placements?.length) {
    return NextResponse.json({ error: "eventId and placements required" }, { status: 400 });
  }
  const ranks = new Set(placements.map(p => p.rank));
  if (![1,2,3].every(r => ranks.has(r as 1|2|3))) {
    return NextResponse.json({ error: "placements must include ranks 1,2,3" }, { status: 400 });
  }
  // Validate each placement
  for (const p of placements) {
    if (!p.studentName?.trim()) {
      return NextResponse.json({ error: `Missing student name for rank ${p.rank}` }, { status: 400 });
    }
    if (!p.institutionId) {
      return NextResponse.json({ error: `Missing institution for rank ${p.rank}` }, { status: 400 });
    }
    if (typeof p.points !== "number" || !Number.isFinite(p.points) || p.points <= 0) {
      return NextResponse.json({ error: `Points must be a positive number for rank ${p.rank}` }, { status: 400 });
    }
  }

  const session = await mongoose.startSession();
  let savedResultId: mongoose.Types.ObjectId | null = null;
  try {
    await session.withTransaction(async () => {
      // Prevent duplicate submissions for same event
      const existing = await Result.findOne({ eventId }).session(session);
      if (existing) throw new Error("Results already submitted for this event");

      // Save result
      const doc = await Result.create([{
        eventId, placements, submittedBy
      }], { session });
      savedResultId = doc[0]._id;

      // Update totals atomically
      for (const p of placements) {
        await Totals.updateOne(
          { institutionId: p.institutionId },
          { $inc: { totalPoints: p.points }, $set: { lastUpdate: new Date() } },
          { upsert: true, session }
        );
      }

      // Broadcast SSE to displays
    });
    if (savedResultId) {
      const enriched = await Result.findById(savedResultId)
        .populate({ path: "eventId", select: "name level" })
        .populate({ path: "placements.institutionId", select: "displayName code" })
        .lean();

      const enrichedDoc = enriched as any;
      const payload = enrichedDoc
        ? {
            id: String(enrichedDoc._id),
            eventId,
            eventName: enrichedDoc.eventId?.name ?? "",
            eventLevel: (enrichedDoc.eventId as any)?.level ?? null,
            placements: (enrichedDoc.placements || []).map((p: any) => ({
              rank: p.rank,
              studentName: p.studentName,
              institutionId: String(p.institutionId?._id ?? p.institutionId),
              institutionName: p.institutionId?.displayName ?? "",
              institutionCode: p.institutionId?.code ?? "",
              points: p.points
            })),
            submittedAt: enrichedDoc.submittedAt?.toISOString?.() ?? new Date().toISOString()
          }
        : null;

      if (payload) {
        broadcast({ type: "result", payload });
      }
    }

    return NextResponse.json({ ok: true, id: savedResultId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 400 });
  } finally {
    session.endSession();
  }
}

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") as "high_school" | "higher_secondary" | null;
  
  // Build query to filter by level if specified
  let query: any = {};
  if (level) {
    const { EventModel } = await import("@/lib/models");
    const events = await EventModel.find({ level, isActive: true }).select("_id").lean();
    const eventIds = events.map(e => e._id);
    query = { eventId: { $in: eventIds } };
  }
  
  const results = await Result.find(query)
    .sort({ submittedAt: -1 })
    .limit(15)
    .populate({ path: "eventId", select: "name level" })
    .populate({ path: "placements.institutionId", select: "displayName code" })
    .lean();

  const data = results.map((r) => ({
    id: String(r._id),
    eventId: String(r.eventId?._id ?? r.eventId),
    eventName: (r.eventId as any)?.name ?? "",
    eventLevel: (r.eventId as any)?.level ?? null,
    submittedAt: r.submittedAt?.toISOString?.() ?? new Date().toISOString(),
    placements: (r.placements || []).map((p: any) => ({
      rank: p.rank,
      studentName: p.studentName,
      points: p.points,
      institutionId: String(p.institutionId?._id ?? p.institutionId),
      institutionName: p.institutionId?.displayName ?? "",
      institutionCode: p.institutionId?.code ?? ""
    }))
  }));

  return NextResponse.json({ data });
}

export async function DELETE(req: Request) {
  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const resultId = searchParams.get("id");
    
    if (!resultId) {
      return NextResponse.json({ error: "Result ID is required" }, { status: 400 });
    }

    const result = await Result.findById(resultId).lean() as any;
    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    await Result.deleteOne({ _id: resultId });

    // Broadcast deletion to all displays
    broadcast({ 
      type: "result_deleted", 
      payload: { id: resultId, eventId: String(result?.eventId || resultId) }
    });

    return NextResponse.json({ ok: true, deleted: resultId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to delete result" }, { status: 400 });
  }
}
