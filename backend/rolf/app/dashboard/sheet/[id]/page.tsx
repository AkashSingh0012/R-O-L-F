"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Sheet, Op } from "@fortune-sheet/core";
import "@fortune-sheet/react/dist/index.css";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { WorkbookInstance } from "@fortune-sheet/react";

const Workbook = dynamic(
    () => import("@fortune-sheet/react").then((m) => m.Workbook),
    { ssr: false }
);

interface SheetPageProps {
    params: Promise<{ id: string }>;
}

interface PresenceUser {
    userId: string;
    username: string;
    color: string;
}

export default function SheetPage({ params }: SheetPageProps) {
    const { id } = use(params);
    const router = useRouter();
    const dataLoaded = useRef(false);
    const dataRef = useRef<Sheet[]>([]);
    const workbookRef = useRef<WorkbookInstance>(null);
    const currentUserRef = useRef<{ userId: string; username: string } | null>(null);
    const isApplyingRemoteOp = useRef(false);

    const [data, setData] = useState<Sheet[]>([
        { name: "Sheet1", celldata: [], row: 50, column: 26 },
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
    const [presence, setPresence] = useState<PresenceUser[]>([]);
    const [lockDenied, setLockDenied] = useState<string | null>(null);

    const getActiveSheetId = useCallback((): string => {
        return dataRef.current?.[0]?.id ?? "";
    }, []);

    useEffect(() => {
        const fetchSheet = async () => {
            try {
                const res = await fetch(`/api/sheets/${id}`, { credentials: "include" });
                if (!res.ok) {
                    const errorBody = await res.json();
                    throw new Error(errorBody.error || "Failed to load sheet");
                }
                const sheet = await res.json();

                if (sheet.SheetData?.data) {
                    const savedSheets = sheet.SheetData.data;
                    if (Array.isArray(savedSheets)) {
                        const restored = savedSheets.map((s: any) => {
                            const celldata: any[] = [];
                            if (Array.isArray(s.data)) {
                                s.data.forEach((row: any[], rowIndex: number) => {
                                    if (Array.isArray(row)) {
                                        row.forEach((cell: any, colIndex: number) => {
                                            if (cell !== null && cell !== undefined) {
                                                celldata.push({ r: rowIndex, c: colIndex, v: cell });
                                            }
                                        });
                                    }
                                });
                            }
                            return { ...s, data: undefined, celldata };
                        });
                        setData(restored);
                        dataRef.current = restored;
                    }
                } else {
                    const initial = [{
                        name: sheet.name,
                        celldata: [],
                        row: 50,
                        column: 26,
                        luckysheet_select_save: [],
                    }];
                    setData(initial);
                    dataRef.current = initial;
                }

                dataLoaded.current = true;

                const sessionRes = await fetch("/api/Auth/me", { credentials: "include" });
                if (sessionRes.ok) {
                    const me = await sessionRes.json();
                    currentUserRef.current = { userId: me.id, username: me.username };
                    initSocket(me.id, me.username);
                }

            } catch (err) {
                setError("Could not load sheet.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSheet();
        return () => { disconnectSocket(); };
    }, [id]);

    const initSocket = (userId: string, username: string) => {
        const socket = getSocket();
        socket.connect();

        // ── Presence position polling ──
        let lastRow = -1;
        let lastCol = -1;

        const selectionInterval = setInterval(() => {
            if (!workbookRef.current || !currentUserRef.current) return;
            const selection = workbookRef.current.getSelection();
            if (!selection || selection.length === 0) return;

            const sel = selection[0];
            const row = sel.row[0];
            const col = sel.column[0];

            if (row === lastRow && col === lastCol) return;

            lastRow = row;
            lastCol = col;

            const user = currentUserRef.current;
            socket.emit("cell-select", {
                sheetId: parseInt(id),
                userId: user.userId,
                username: user.username,
                row,
                col,
                sheetId_str: getActiveSheetId(),
            });
        }, 200);

        socket.on("disconnect", () => clearInterval(selectionInterval));
        // ── End presence polling ──

        socket.emit("join-sheet", { sheetId: parseInt(id), userId, username });

        socket.on("init", ({ users }: { users: PresenceUser[], locks: any }) => {
            const others = users.filter(u => u.userId !== userId);
            setPresence(others);
            setTimeout(() => {
                if (workbookRef.current && others.length > 0) {
                    workbookRef.current.addPresences(
                        others.map(u => ({
                            userId: u.userId,
                            username: u.username,
                            color: u.color,
                            sheetId: getActiveSheetId(),
                            selection: { r: 0, c: 0 },
                        }))
                    );
                }
            }, 500);
        });

        socket.on("user-joined", (user: PresenceUser) => {
            setPresence(prev => [...prev.filter(u => u.userId !== user.userId), user]);
            setTimeout(() => {
                workbookRef.current?.addPresences([{
                    userId: user.userId,
                    username: user.username,
                    color: user.color,
                    sheetId: getActiveSheetId(),
                    selection: { r: 0, c: 0 },
                }]);
            }, 500);
        });

        socket.on("user-left", ({ userId: leftId }: { userId: string }) => {
            setPresence(prev => prev.filter(u => u.userId !== leftId));
            workbookRef.current?.removePresences([{ username: leftId, userId: leftId }]);
        });

        socket.on("cell-updated", ({ ops, userId: fromUserId }: { ops: Op[], userId: string }) => {
            if (fromUserId === userId) return;
            if (!workbookRef.current) return;
            isApplyingRemoteOp.current = true;
            workbookRef.current.applyOp(ops);
            isApplyingRemoteOp.current = false;
        });

        socket.on("cell-presence", ({ userId: fromId, username: fromName, color, row, col, sheetId: fromSheetId }: any) => {
            if (fromId === userId) return;
            workbookRef.current?.addPresences([{
                userId: fromId,
                username: fromName,
                color,
                sheetId: fromSheetId ?? getActiveSheetId(),
                selection: { r: row, c: col },
            }]);
        });

        socket.on("lock-denied", ({ cellRef, lockedBy }: { cellRef: string, lockedBy: string }) => {
            setLockDenied(`Cell ${cellRef} is locked by ${lockedBy}`);
            setTimeout(() => setLockDenied(null), 3000);
        });
    };

    const handleOp = useCallback((ops: Op[]) => {
        if (isApplyingRemoteOp.current) return;
        const socket = getSocket();
        socket.emit("cell-change", {
            sheetId: parseInt(id),
            ops,
        });

        const selection = workbookRef.current?.getSelection();
        if (selection && selection.length > 0 && currentUserRef.current) {
            const user = currentUserRef.current;
            const sel = selection[0];
            socket.emit("cell-select", {
                sheetId: parseInt(id),
                userId: user.userId,
                username: user.username,
                row: sel.row[0],
                col: sel.column[0],
                sheetId_str: getActiveSheetId(),
            });
        }
    }, [id, getActiveSheetId]);

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus("idle");
        try {
            const res = await fetch(`/api/sheets/${id}/save`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: dataRef.current.map(sheet => ({
                        ...sheet,
                        celldata: undefined,
                    }))
                }),
            });
            const responseBody = await res.json();
            if (!res.ok) throw new Error(responseBody.error || "Save failed");
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
            console.error("Save error:", err);
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-gray-500">Loading sheet...</p>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-red-500">{error}</p>
        </div>
    );

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{
                padding: "8px 16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex", alignItems: "center", gap: "12px",
                background: "white",
            }}>
                <button onClick={() => router.push("/dashboard")} style={{
                    padding: "6px 16px", background: "white", color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: "6px",
                    cursor: "pointer", fontWeight: 500,
                }}>
                    ← Dashboard
                </button>

                <button onClick={handleSave} disabled={saving} style={{
                    padding: "6px 16px",
                    background: saving ? "#9ca3af" : "#2563eb",
                    color: "white", border: "none", borderRadius: "6px",
                    cursor: saving ? "not-allowed" : "pointer", fontWeight: 500,
                }}>
                    {saving ? "Saving..." : "Save"}
                </button>

                {saveStatus === "saved" && <span style={{ color: "#16a34a", fontSize: "14px" }}>✓ Saved</span>}
                {saveStatus === "error" && <span style={{ color: "#dc2626", fontSize: "14px" }}>✗ Save failed</span>}

                {lockDenied && (
                    <span style={{
                        background: "#fef2f2", border: "1px solid #fecaca",
                        color: "#dc2626", fontSize: "13px",
                        padding: "4px 12px", borderRadius: "6px",
                    }}>
                        🔒 {lockDenied}
                    </span>
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
                    {presence.map(u => (
                        <div key={u.userId} title={u.username} style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: u.color, color: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 700,
                        }}>
                            {u.username[0].toUpperCase()}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <Workbook
                    ref={workbookRef}
                    data={data}
                    onChange={(updatedData) => {
                        if (dataLoaded.current) {
                            setData(updatedData);
                            dataRef.current = updatedData;
                        }
                    }}
                    onOp={handleOp}
                />
            </div>
        </div>
    );
}