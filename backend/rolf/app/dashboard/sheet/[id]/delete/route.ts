import { NextRequest, NextResponse } from "next/server";
import{ prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sheetId = parseInt(id);

  // Validate session
  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { token },
    include: { User: true },
  });

  if (!session || session.expires < new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const user = session.User;

  // ADMIN bypass — can delete any sheet
  if (user.role !== "ADMIN") {
    const permission = await prisma.sheetPermission.findUnique({
      where: { sheetId_userId: { sheetId, userId: user.id } },
    });

    if (!permission || permission.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.sheet.delete({ where: { id: sheetId } });

  return NextResponse.json({ success: true });
}