import { NextResponse } from "next/server";
import { getLicensePagePayload } from "@/lib/license/licensePayload";

export async function GET() {
  try {
    const data = await getLicensePagePayload();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: "Failed to aggregate license metadata" },
      { status: 500 }
    );
  }
}
