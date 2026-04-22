import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "./Navbar";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) redirect("/Auth");

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    const user = session?.User;
    if (!user) redirect("/Auth");

    // ── Active sheets ──
    const workbooks = await prisma.sheet.findMany({
        where: user.role === "ADMIN"
            ? { deletedAt: null }
            : {
                deletedAt: null,
                OR: [
                    { createdBy: user.id },
                    { SheetPermission: { some: { userId: user.id } } },
                ],
            },
        orderBy: { createdAt: "desc" },
        include: {
            User: { select: { username: true } },
            SheetPermission: {
                where: { userId: user.id },
                select: { role: true },
            },
        },
    });

    // ── Deleted sheets (recycle bin) ──
    const deletedWorkbooks = user.role === "ADMIN"
        ? await prisma.sheet.findMany({
            where: { deletedAt: { not: null } },
            orderBy: { deletedAt: "desc" },
            include: { User: { select: { username: true } } },
        })
        : await prisma.sheet.findMany({
            where: {
                deletedAt: { not: null },
                SheetPermission: { some: { userId: user.id, role: "OWNER" } },
            },
            orderBy: { deletedAt: "desc" },
            include: { User: { select: { username: true } } },
        });

    return (
        <div className="flex flex-col h-screen">
            <Navbar role={user.role} />
            <div className="flex flex-1 overflow-hidden">
                <div className="w-full p-4 overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">
                        {user.role === "ADMIN" ? "All Workbooks" : "My Workbooks"}
                    </h2>
                    <DashboardClient
                        workbooks={workbooks.map((s) => ({
                            ...s,
                            createdAt: s.createdAt.toISOString(),
                            updatedAt: s.updatedAt.toISOString(),
                            deletedAt: s.deletedAt?.toISOString() ?? null,
                            userSheetRole: s.SheetPermission?.[0]?.role ?? (s.createdBy === user.id ? "OWNER" : null),
                        }))}
                        deletedWorkbooks={deletedWorkbooks.map((s) => ({
                            ...s,
                            createdAt: s.createdAt.toISOString(),
                            updatedAt: s.updatedAt.toISOString(),
                            deletedAt: s.deletedAt?.toISOString() ?? null,
                        }))}
                        isAdmin={user.role === "ADMIN"}
                    />
                </div>
            </div>
        </div>
    );
}