import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const token = (await cookies()).get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    if (!session || session.expires < new Date()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        id: session.User.id,
        username: session.User.username,
        email: session.User.email,
        role: session.User.role,
    });
}