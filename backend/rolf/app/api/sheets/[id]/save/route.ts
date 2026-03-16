import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { data } = await req.json();

        if (!data) {
            return NextResponse.json({ error: "No data provided" }, { status: 400 });
        }

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

        // ✅ ADMIN bypasses permission check
        if (session.User.role !== "ADMIN") {
            const permission = await prisma.sheetPermission.findUnique({
                where: {
                    sheetId_userId: {
                        sheetId,
                        userId: session.userId,
                    },
                },
            });

            if (!permission || permission.role === "VIEWER") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        await prisma.sheetData.upsert({
            where: { sheetId },
            update: {
                data: data,
                updatedBy: session.userId,
            },
            create: {
                sheetId,
                data: data,
                updatedBy: session.userId,
            },
        });

        await prisma.auditLog.create({
            data: {
                sheetId,
                userId: session.userId,
                action: "UPDATED",
                details: { message: "Sheet data saved" },
            },
        });

        await prisma.sheet.update({
            where: { id: sheetId },
            data: { version: { increment: 1 } },
        });

        return NextResponse.json({ message: "Saved successfully" }, { status: 200 });

    } catch (err) {
        console.error("Save sheet error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}