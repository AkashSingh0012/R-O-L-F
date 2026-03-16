import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

            if (!permission) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const sheet = await prisma.sheet.findUnique({
            where: { id: sheetId },
            include: { SheetData: true },
        });

        if (!sheet) {
            return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
        }

        return NextResponse.json(sheet);

    } catch (err) {
        console.error("Get sheet error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}