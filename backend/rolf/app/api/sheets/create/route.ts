import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
    try {
        const { name } = await req.json();

        if (!name || typeof name !== "string" || name.trim() === "") {
            return NextResponse.json(
                { error: "Sheet name is required" },
                { status: 400 }
            );
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

        // ✅ RBAC — only USER or ADMIN can create sheets
        if (!["USER", "ADMIN"].includes(session.User.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // ✅ Transaction — sheet + permission created together or not at all
        const newSheet = await prisma.$transaction(async (tx) => {
            const sheet = await tx.sheet.create({
                data: {
                    name: name.trim(),
                    createdBy: session.userId,
                },
            });

            // ✅ Auto-assign OWNER permission to creator
            await tx.sheetPermission.create({
                data: {
                    sheetId: sheet.id,
                    userId: session.userId,
                    role: "OWNER",
                },
            });

            return sheet;
        });

        return NextResponse.json(newSheet, { status: 201 });

    } catch (err) {
        console.error("Create sheet error:", err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}