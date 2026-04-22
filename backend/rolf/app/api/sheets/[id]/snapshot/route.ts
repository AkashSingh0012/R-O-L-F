import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(
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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        include: { SheetData: true },
    });

    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (!sheet.SheetData?.data) return NextResponse.json({ error: "No data to snapshot" }, { status: 400 });

    // Always upsert version 1 — single slot, overwrites on every snapshot
    await prisma.sheetVersion.upsert({
        where: { sheetId_version: { sheetId, version: 1 } },
        update: {
            data: sheet.SheetData.data,
            savedBy: user.id,
        },
        create: {
            sheetId,
            version: 1,
            data: sheet.SheetData.data,
            savedBy: user.id,
        },
    });

    // Keep snapshotData on Sheet in sync (used by dashboard badge + legacy restore)
    await prisma.sheet.update({
        where: { id: sheetId },
        data: {
            snapshotData: sheet.SheetData.data,
            snapshotAt: new Date(),
            snapshotBy: user.id,
        },
    });

    await prisma.auditLog.create({
        data: {
            sheetId,
            userId: user.id,
            action: "UPDATED",
            details: { message: `Snapshot overwritten by ${user.username}` },
        },
    });

    return NextResponse.json({ success: true });
}