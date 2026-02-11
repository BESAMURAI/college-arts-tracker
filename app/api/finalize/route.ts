import dns from "node:dns/promises";

dns.setServers(["1.1.1.1"]);
import { NextResponse } from "next/server";
import { broadcast } from "@/lib/sse";

// Simple in-memory state for finalize (could be moved to database if persistence needed)
let isFinalized = false;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "finalize") {
      isFinalized = true;
      broadcast({ type: "finalize", payload: { finalized: true } });
      return NextResponse.json({ ok: true, finalized: true });
    } else if (action === "undo") {
      isFinalized = false;
      broadcast({ type: "finalize", payload: { finalized: false } });
      return NextResponse.json({ ok: true, finalized: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ finalized: isFinalized });
}

