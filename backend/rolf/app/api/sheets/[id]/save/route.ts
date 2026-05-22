import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const sheetId = parseInt(id);

        if (isNaN(sheetId)) {
            return NextResponse.json({ error: "Invalid sheet ID" }, { status: 400 });
        }

        const token = (await cookies()).get("session")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse body and auth check in parallel
        const [{ data }, session] = await Promise.all([
            req.json(),
            prisma.session.findUnique({
                where: { token },
                select: {
                    expires: true,
                    userId: true,
                    User: { select: { role: true } },
                },
            }),
        ]);

        if (!data) {
            return NextResponse.json({ error: "No data provided" }, { status: 400 });
        }

        if (!session || session.expires < new Date()) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Permission check (ADMIN bypasses)
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
                select: { role: true },
            });
            if (!permission || permission.role === "VIEWER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Core save — this is what the user is waiting for
        await prisma.sheetData.upsert({
            where: { sheetId },
            update: { data, updatedBy: session.userId },
            create: { sheetId, data, updatedBy: session.userId },
        });

        // Respond immediately — audit log + version bump run in background
        Promise.all([
            prisma.auditLog.create({
                data: {
                    sheetId,
                    userId: session.userId,
                    action: "UPDATED",
                    details: { message: "Sheet data saved" },
                },
            }),
            prisma.sheet.update({
                where: { id: sheetId },
                data: { version: { increment: 1 } },
            }),
        ]).catch((err) => console.error("Post-save background tasks failed:", err));

        return NextResponse.json({ message: "Saved successfully" }, { status: 200 });

    } catch (err) {
        console.error("Save sheet error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}