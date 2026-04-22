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

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    if (!session || session.expires < new Date()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.User;

    // Only OWNER or ADMIN can rename
    if (user.role !== "ADMIN") {
        const permission = await prisma.sheetPermission.findUnique({
            where: { sheetId_userId: { sheetId, userId: user.id } },
        });
        if (!permission || permission.role !== "OWNER") {
            return NextResponse.json({ error: "Only the sheet owner can rename it" }, { status: 403 });
        }
    }

    const body = await req.json();
    const name = body?.name?.toString().trim();

    if (!name) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (name.length > 100) {
        return NextResponse.json({ error: "Name too long (max 100 characters)" }, { status: 400 });
    }

    const sheet = await prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });

    const updated = await prisma.sheet.update({
        where: { id: sheetId },
        data: { name },
    });

    await prisma.auditLog.create({
        data: {
            sheetId,
            userId: user.id,
            action: "UPDATED",
            details: {
                message: `Sheet renamed from "${sheet.name}" to "${name}" by ${user.username}`,
            },
        },
    });

    return NextResponse.json({ success: true, name: updated.name });
}