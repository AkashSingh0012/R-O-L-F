import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sheetId = parseInt(id);

    const token = (await cookies()).get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    if (!session || session.expires < new Date()) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const user = session.User;

    if (user.role !== "ADMIN") {
        const permission = await prisma.sheetPermission.findUnique({
            where: { sheetId_userId: { sheetId, userId: user.id } },
        });
        if (!permission || permission.role !== "OWNER") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    // ── Soft delete ──
    await prisma.sheet.update({
        where: { id: sheetId },
        data: { deletedAt: new Date() },
    });

    // ── Audit log ──
    await prisma.auditLog.create({
        data: {
            sheetId,
            userId: user.id,
            action: "DELETED",
            details: { message: `Sheet soft deleted by ${user.username}` },
        },
    });

    return NextResponse.json({ success: true });
}