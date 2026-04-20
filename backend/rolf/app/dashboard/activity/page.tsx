import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "../Navbar";
import Link from "next/link";

export default async function ActivityPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) redirect("/Auth");

    const session = await prisma.session.findUnique({
        where: { token },
        include: { User: true },
    });

    const user = session?.User;
    if (!user) redirect("/Auth");

    if (user.role !== "ADMIN") redirect("/dashboard");

    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            User: { select: { username: true } },
            Sheet: { select: { name: true } },
        },
    });

    return (
        <div className="flex flex-col h-screen">
            <Navbar role={user.role} />
            <div className="flex flex-1 overflow-hidden">
                <div className="w-full max-w-3xl mx-auto p-6 overflow-y-auto">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                        <Link href="/dashboard" style={{
                            padding: "6px 14px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            fontSize: "13px",
                            color: "#374151",
                            textDecoration: "none",
                            background: "white",
                        }}>
                            ← Dashboard
                        </Link>
                        <h2 className="text-xl font-bold">Global Activity Feed</h2>
                    </div>

                    {logs.length === 0 && (
                        <p className="text-gray-400 text-sm">No activity yet.</p>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 8px",
                            borderBottom: "1px solid #e5e7eb",
                            gap: "8px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    background: log.action === "UPDATED" ? "#dbeafe"
                                        : log.action === "ADDED" ? "#dcfce7"
                                        : "#fee2e2",
                                    color: log.action === "UPDATED" ? "#1d4ed8"
                                        : log.action === "ADDED" ? "#15803d"
                                        : "#dc2626",
                                }}>
                                    {log.action}
                                </span>
                                <div>
                                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                                        {log.Sheet.name}
                                    </p>
                                    <p style={{ fontSize: "12px", color: "#6b7280" }}>
                                        by {log.User.username}
                                    </p>
                                </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <p style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                                    {log.createdAt.toLocaleDateString()}
                                </p>
                                <p style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                                    {log.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}