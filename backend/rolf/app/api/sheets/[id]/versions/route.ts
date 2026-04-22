import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(
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

    // Any sheet participant can view version history (OWNER, EDITOR, VIEWER, ADMIN)
    if (user.role !== "ADMIN") {
        const permission = await prisma.sheetPermission.findUnique({
            where: { sheetId_userId: { sheetId, userId: user.id } },
        });
        if (!permission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const versions = await prisma.sheetVersion.findMany({
        where: { sheetId },
        orderBy: { version: "desc" },
        select: {
            id: true,
            version: true,
            createdAt: true,
            savedBy: true,
            User: {
                select: { username: true },
            },
        },
    });

    return NextResponse.json(versions);
}