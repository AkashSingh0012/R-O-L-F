import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sheetId = parseInt(id);

    const token = (await cookies()).get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse body and auth check in parallel
    const [session, body] = await Promise.all([
        prisma.session.findUnique({
            where: { token },
            include: { User: true },
        }),
        req.json(),
    ]);

    if (!session || session.expires < new Date()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.User;

    // Validate name early — no point hitting the DB if the input is bad
    const name = body?.name?.toString().trim();
    if (!name) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (name.length > 100) {
        return NextResponse.json({ error: "Name too long (max 100 characters)" }, { status: 400 });
    }

    // Permission check (skip for ADMIN)
    if (user.role !== "ADMIN") {
        const permission = await prisma.sheetPermission.findUnique({
            where: { sheetId_userId: { sheetId, userId: user.id } },
        });
        if (!permission || permission.role !== "OWNER") {
            return NextResponse.json({ error: "Only the sheet owner can rename it" }, { status: 403 });
        }
    }

    // Update — select the old name in the same query, no separate findUnique needed
    let updated;
    try {
        updated = await prisma.sheet.update({
            where: { id: sheetId },
            data: { name },
            select: { name: true, id: true },
        });
    } catch (err: any) {
        // Prisma throws P2025 if the record doesn't exist
        if (err?.code === "P2025") {
            return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
        }
        throw err;
    }

    // Fire-and-forget audit log — does not block the response
    prisma.auditLog.create({
        data: {
            sheetId,
            userId: user.id,
            action: "UPDATED",
            details: {
                message: `Sheet renamed to "${name}" by ${user.username}`,
            },
        },
    }).catch((err) => console.error("Audit log error:", err));

    return NextResponse.json({ success: true, name: updated.name });
}