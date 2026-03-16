import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "./Navbar";
import Link from "next/link";
import { NextResponse } from "next/server";

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) redirect("/login");

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    const user = session?.User;
    if (!user) redirect("/login");

    // ✅ ADMIN sees all sheets, others see only their own
    const workbooks = await prisma.sheet.findMany({
        where: user.role === "ADMIN" ? {} : { createdBy: user.id },
        orderBy: { createdAt: "desc" },
        include: {
            User: { select: { username: true } },
        },
    });
    const recentLogs = user.role === "ADMIN"
        ? await prisma.auditLog.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
                User: { select: { username: true } },
            },
          })
        : [];

    return (
        <div className="flex flex-col h-screen">
            <Navbar />
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/2 p-4 border-r overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">
                        {user.role === "ADMIN" ? "All Workbooks" : "Your Workbooks"}
                    </h2>
                    {workbooks.length === 0 && (
                        <p className="text-gray-400 text-sm">No sheets yet. Create one!</p>
                    )}
                    {workbooks.map((sheet) => (
                        <Link key={sheet.id} href={`/dashboard/sheet/${sheet.id}`}>
                            <div className="p-3 border-b hover:bg-gray-100 cursor-pointer rounded">
                                <p className="font-medium">{sheet.name}</p>
                                <p className="text-xs text-gray-400">
                                    Created {sheet.createdAt.toLocaleDateString()}
                                    {}
                                    {user.role === "ADMIN" && (
                                        <span className="ml-2 text-blue-400">
                                            by {sheet.User.username}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>

                {user.role === "ADMIN" && (
                    <div className="w-1/2 p-4 bg-gray-50 overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Global Activity Feed</h2>
                        {recentLogs.length === 0 && (
                            <p className="text-gray-400 text-sm">No activity yet.</p>
                        )}
                        {recentLogs.map((log) => (
                            <div key={log.id} className="text-sm p-2 border-b">
                                <span className="font-medium">{log.action}</span>
                                <span className="text-blue-400 ml-2">
                                    {log.User.username}
                                </span>
                                <span className="text-gray-400 ml-2">
                                    {log.createdAt.toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}