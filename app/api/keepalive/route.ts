import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Ping database to keep connection alive
    await dbConnect();
    return NextResponse.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      message: "Service is alive and database connection is active"
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: "error", 
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

