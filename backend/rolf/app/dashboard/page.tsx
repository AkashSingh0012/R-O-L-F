import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "./Navbar";
import DashboardClient from "./DashboardClient";

// Fields needed by the dashboard — excludes snapshotData (large JSON blob)
const sheetSelect = {
    id: true,
    name: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    snapshotAt: true,
    User: { select: { username: true } },
} as const;

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

    const isAdmin = user.role === "ADMIN";

    // ── Run active + deleted sheet queries in parallel ──
    const [workbooksRaw, deletedWorkbooksRaw] = await Promise.all([
        // Active sheets
        prisma.sheet.findMany({
            where: isAdmin
                ? { deletedAt: null }
                : {
                    deletedAt: null,
                    OR: [
                        { createdBy: user.id },
                        { SheetPermission: { some: { userId: user.id } } },
                    ],
                },
            orderBy: { createdAt: "desc" },
            select: {
                ...sheetSelect,
                SheetPermission: {
                    where: { userId: user.id },
                    select: { role: true },
                },
            },
        }),

        // Deleted sheets (recycle bin)
        prisma.sheet.findMany({
            where: isAdmin
                ? { deletedAt: { not: null } }
                : {
                    deletedAt: { not: null },
                    SheetPermission: { some: { userId: user.id, role: "OWNER" } },
                },
            orderBy: { deletedAt: "desc" },
            select: sheetSelect,
        }),
    ]);

    return (
        <div className="flex flex-col h-screen">
            <Navbar role={user.role} />
            <div className="flex flex-1 overflow-hidden">
                <div className="w-full p-4 overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">
                        {isAdmin ? "All Workbooks" : "My Workbooks"}
                    </h2>
                    <DashboardClient
                        workbooks={workbooksRaw.map((s) => ({
                            ...s,
                            createdAt: s.createdAt.toISOString(),
                            updatedAt: s.updatedAt.toISOString(),
                            deletedAt: s.deletedAt?.toISOString() ?? null,
                            snapshotAt: s.snapshotAt?.toISOString() ?? null,
                            userSheetRole: s.SheetPermission?.[0]?.role ?? (s.createdBy === user.id ? "OWNER" : null),
                        }))}
                        deletedWorkbooks={deletedWorkbooksRaw.map((s) => ({
                            ...s,
                            createdAt: s.createdAt.toISOString(),
                            updatedAt: s.updatedAt.toISOString(),
                            deletedAt: s.deletedAt?.toISOString() ?? null,
                        }))}
                        isAdmin={isAdmin}
                    />
                </div>
            </div>
        </div>
    );
}