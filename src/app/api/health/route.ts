import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      environment: process.env.NODE_ENV,
      services: {
        database: "ok",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
