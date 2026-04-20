import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth"; // your session helper

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sheetId = parseInt(params.id);
  const { targetVersion } = await req.json();
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Permission check: ADMIN or sheet OWNER only ──
  const isAdmin = user.role === "ADMIN";
  const isOwner = await prisma.sheetPermission.findFirst({
    where: { sheetId, userId: user.id, role: "OWNER" },
  });

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Find the target snapshot ──
  const snapshot = await prisma.sheetVersion.findUnique({
    where: { sheetId_version: { sheetId, version: targetVersion } },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // ── 3. Get current sheet for audit ──
  const currentSheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    include: { SheetData: true },
  });

  if (!currentSheet) {
    return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
  }

  const newVersion = currentSheet.version + 1;

  // ── 4. Atomic transaction: snapshot current → restore target ──
  await prisma.$transaction([
    // Save current state as a new version before overwriting
    prisma.sheetVersion.create({
      data: {
        sheetId,
        version: newVersion,
        data: currentSheet.SheetData?.data ?? {},
        savedBy: user.id,
      },
    }),

    // Restore the target snapshot into SheetData
    prisma.sheetData.update({
      where: { sheetId },
      data: {
        data: snapshot.data,
        updatedBy: user.id,
      },
    }),

    // Bump sheet version counter
    prisma.sheet.update({
      where: { id: sheetId },
      data: { version: newVersion },
    }),

    // Audit log
    prisma.auditLog.create({
      data: {
        sheetId,
        userId: user.id,
        action: "ROLLED_BACK",
        details: {
          restoredToVersion: targetVersion,
          previousVersion: currentSheet.version,
          newVersion,
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    restoredToVersion: targetVersion,
    newVersion,
  });
}