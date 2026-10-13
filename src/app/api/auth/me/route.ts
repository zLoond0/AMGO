import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const result = requireAuth(request);
    if (result instanceof NextResponse) return result;

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    if ((error as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") {
      throw error;
    }
    console.error("Error en GET /api/auth/me:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
