import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getSessionAndSheet(token: string | undefined, sheetId: number) {
    if (!token) return null;
    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });
    if (!session || session.expires < new Date()) return null;
    return session;
}

// GET — list all permissions for a sheet
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = (await cookies()).get("session")?.value;
        const session = await getSessionAndSheet(token, parseInt(id));
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const sheetId = parseInt(id);

        // Only OWNER or ADMIN can view permissions
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
            });
            if (!permission || permission.role !== "OWNER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const permissions = await prisma.sheetPermission.findMany({
            where: { sheetId },
            include: { User: { select: { id: true, username: true, email: true } } },
        });

        return NextResponse.json(permissions);
    } catch (err) {
        console.error("Get permissions error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

// POST — share with a new user
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = (await cookies()).get("session")?.value;
        const session = await getSessionAndSheet(token, parseInt(id));
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const sheetId = parseInt(id);
        const { username, role } = await req.json();

        if (!username || !role || !["EDITOR", "VIEWER"].includes(role)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        // Only OWNER or ADMIN can share
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
            });
            if (!permission || permission.role !== "OWNER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Find the target user
        const targetUser = await prisma.user.findUnique({
            where: { username },
        });
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Can't share with yourself
        if (targetUser.id === session.userId) {
            return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
        }

        // Upsert — update if already exists, create if not
        const result = await prisma.sheetPermission.upsert({
            where: { sheetId_userId: { sheetId, userId: targetUser.id } },
            update: { role },
            create: { sheetId, userId: targetUser.id, role },
        });

        return NextResponse.json(result, { status: 201 });
    } catch (err) {
        console.error("Share sheet error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

// PATCH — update an existing permission
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = (await cookies()).get("session")?.value;
        const session = await getSessionAndSheet(token, parseInt(id));
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const sheetId = parseInt(id);
        const { userId, role } = await req.json();

        if (!userId || !role || !["EDITOR", "VIEWER"].includes(role)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        // Only OWNER or ADMIN can update
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
            });
            if (!permission || permission.role !== "OWNER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const updated = await prisma.sheetPermission.update({
            where: { sheetId_userId: { sheetId, userId } },
            data: { role },
        });

        return NextResponse.json(updated);
    } catch (err) {
        console.error("Update permission error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

// DELETE — revoke a user's permission
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const token = (await cookies()).get("session")?.value;
        const session = await getSessionAndSheet(token, parseInt(id));
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const sheetId = parseInt(id);
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        // Only OWNER or ADMIN can revoke
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: { sheetId_userId: { sheetId, userId: session.userId } },
            });
            if (!permission || permission.role !== "OWNER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        await prisma.sheetPermission.delete({
            where: { sheetId_userId: { sheetId, userId } },
        });

        return NextResponse.json({ message: "Permission revoked" });
    } catch (err) {
        console.error("Delete permission error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}