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

    // Only OWNER or ADMIN can restore
    if (user.role !== "ADMIN") {
        const permission = await prisma.sheetPermission.findUnique({
            where: { sheetId_userId: { sheetId, userId: user.id } },
        });
        if (!permission || permission.role !== "OWNER") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    // Body is optional — version is only present when called from the sheet editor
    // When called from the dashboard (no body), we fall back to sheet.snapshotData
    let version: number | undefined;
    try {
        const body = await req.json();
        if (typeof body?.version === "number") {
            version = body.version;
        }
    } catch {
        // No body sent — dashboard path, version stays undefined
    }

    let dataToRestore: unknown;
    let label: string;

    if (version !== undefined) {
        // ── Versioned restore (from sheet editor history panel) ──
        const sheetVersion = await prisma.sheetVersion.findUnique({
            where: { sheetId_version: { sheetId, version } },
        });
        if (!sheetVersion) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }
        dataToRestore = sheetVersion.data;
        label = `v${version}`;
    } else {
        // ── Legacy snapshot restore (from dashboard Restore button) ──
        const sheet = await prisma.sheet.findUnique({
            where: { id: sheetId },
            select: { snapshotData: true, snapshotAt: true },
        });
        if (!sheet?.snapshotData) {
            return NextResponse.json({ error: "No snapshot exists for this sheet" }, { status: 400 });
        }
        dataToRestore = sheet.snapshotData;
        label = `snapshot from ${sheet.snapshotAt?.toISOString() ?? "unknown date"}`;
    }

    // Restore SheetData
    await prisma.sheetData.upsert({
        where: { sheetId },
        update: {
            data: dataToRestore as any,
            updatedBy: user.id,
        },
        create: {
            sheetId,
            data: dataToRestore as any,
            updatedBy: user.id,
        },
    });

    // Bump sheet version counter
    await prisma.sheet.update({
        where: { id: sheetId },
        data: { version: { increment: 1 } },
    });

    await prisma.auditLog.create({
        data: {
            sheetId,
            userId: user.id,
            action: "ROLLED_BACK",
            details: {
                message: `Rolled back to ${label} by ${user.username}`,
                restoredVersion: version ?? null,
            },
        },
    });

    return NextResponse.json({ success: true, restoredVersion: version ?? null });
}