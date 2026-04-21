import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { targetVersion } = await req.json();

        const token = (await cookies()).get("session")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { token },
            include: { User: true },
        });

        if (!session || session.expires < new Date()) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sheetId = parseInt(id);
        if (isNaN(sheetId)) {
            return NextResponse.json({ error: "Invalid sheet ID" }, { status: 400 });
        }

        // ✅ ADMIN or OWNER only
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
            });
            if (!permission || permission.role !== "OWNER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const snapshot = await prisma.sheetVersion.findUnique({
            where: { sheetId_version: { sheetId, version: targetVersion } },
        });
        if (!snapshot) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        const currentSheet = await prisma.sheet.findUnique({
            where: { id: sheetId },
            include: { SheetData: true },
        });
        if (!currentSheet) {
            return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
        }

        const newVersion = currentSheet.version + 1;

        await prisma.$transaction([
            // Save current state as new version before overwriting
            prisma.sheetVersion.create({
                data: {
                    sheetId,
                    version: newVersion,
                    data: currentSheet.SheetData?.data ?? {},
                    savedBy: session.userId,
                },
            }),
            // Restore target snapshot into SheetData
            prisma.sheetData.update({
                where: { sheetId },
                data: {
                    data: snapshot.data,
                    updatedBy: session.userId,
                },
            }),
            // Bump version counter
            prisma.sheet.update({
                where: { id: sheetId },
                data: { version: newVersion },
            }),
            // Audit log
            prisma.auditLog.create({
                data: {
                    sheetId,
                    userId: session.userId,
                    action: "UPDATED",
                    details: {
                        message: `Rolled back to version ${targetVersion}`,
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

    } catch (err) {
        console.error("Rollback error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}