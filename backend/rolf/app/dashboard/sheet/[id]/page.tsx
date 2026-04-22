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

interface LockInfo {
    userId: string;
    username: string;
    color: string;
}

interface SheetVersion {
    id: number;
    version: number;
    createdAt: string;
    savedBy: string;
    User: { username: string };
}

type SheetRole = "OWNER" | "EDITOR" | "VIEWER" | null;

export default function SheetPage({ params }: SheetPageProps) {
    const { id } = use(params);
    const router = useRouter();
    const dataLoaded = useRef(false);
    const dataRef = useRef<Sheet[]>([]);
    const workbookRef = useRef<WorkbookInstance>(null);
    const currentUserRef = useRef<{ userId: string; username: string } | null>(null);
    const isApplyingRemoteOp = useRef(false);
    const activeLocks = useRef<Record<string, LockInfo>>({});
    const onChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [data, setData] = useState<Sheet[]>([
        { name: "Sheet1", celldata: [], row: 50, column: 26 },
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
    const [presence, setPresence] = useState<PresenceUser[]>([]);
    const [lockDenied, setLockDenied] = useState<string | null>(null);

    // Version history state
    const [userRole, setUserRole] = useState<SheetRole>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showVersionPanel, setShowVersionPanel] = useState(false);
    const [versions, setVersions] = useState<SheetVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [snapshotting, setSnapshotting] = useState(false);
    const [snapshotStatus, setSnapshotStatus] = useState<"idle" | "saved" | "error">("idle");
    const [restoring, setRestoring] = useState<number | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<"idle" | "restored" | "error">("idle");

    // Rename state
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameName, setRenameName] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);
    const [sheetName, setSheetName] = useState<string>("");

    const canSnapshotOrRestore = isAdmin || userRole === "OWNER";
    const canEdit = isAdmin || userRole === "OWNER" || userRole === "EDITOR";

    const getActiveSheetId = useCallback((): string => {
        return dataRef.current?.[0]?.id ?? "";
    }, []);

    const fetchVersions = useCallback(async () => {
        setVersionsLoading(true);
        try {
            const res = await fetch(`/api/sheets/${id}/versions`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setVersions(data);
            }
        } catch (err) {
            console.error("Failed to fetch versions:", err);
        } finally {
            setVersionsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        const fetchSheet = async () => {
            try {
                // Fire all three requests in parallel — no sequential waiting
                const [sheetRes, sessionRes, permRes] = await Promise.all([
                    fetch(`/api/sheets/${id}`, { credentials: "include" }),
                    fetch("/api/Auth/me", { credentials: "include" }),
                    fetch(`/api/sheets/${id}/permissions`, { credentials: "include" }),
                ]);

                if (!sheetRes.ok) {
                    const errorBody = await sheetRes.json();
                    throw new Error(errorBody.error || "Failed to load sheet");
                }
                const sheet = await sheetRes.json();

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
                setSheetName(sheet.name);

                if (sessionRes.ok) {
                    const me = await sessionRes.json();
                    currentUserRef.current = { userId: me.id, username: me.username };

                    if (me.role === "ADMIN") {
                        setIsAdmin(true);
                    } else if (permRes.ok) {
                        const perms = await permRes.json();
                        const mine = perms.find((p: any) => p.userId === me.id);
                        setUserRole(mine?.role ?? null);
                    }

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

            if (lastRow !== -1) {
                socket.emit("cell-unlock", {
                    sheetId: parseInt(id),
                    cellRef: `${getActiveSheetId()}:${lastRow}:${lastCol}`,
                });
            }

            lastRow = row;
            lastCol = col;

            socket.emit("cell-lock", {
                sheetId: parseInt(id),
                cellRef: `${getActiveSheetId()}:${row}:${col}`,
            });

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

        socket.emit("join-sheet", { sheetId: parseInt(id), userId, username });

        socket.on("init", ({ users, locks }: { users: PresenceUser[], locks: Record<string, LockInfo> }) => {
            const others = users.filter(u => u.userId !== userId);
            setPresence(others);
            activeLocks.current = locks ?? {};
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
            for (const cellRef in activeLocks.current) {
                if (activeLocks.current[cellRef].userId === leftId) {
                    delete activeLocks.current[cellRef];
                }
            }
        });

        socket.on("cell-updated", ({ ops, userId: fromUserId }: { ops: Op[], userId: string }) => {
            if (fromUserId === userId) return;
            if (!workbookRef.current) return;
            isApplyingRemoteOp.current = true;
            workbookRef.current.applyOp(ops);
            setTimeout(() => {
                isApplyingRemoteOp.current = false;
            }, 100);
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

        socket.on("cell-locked", ({ cellRef, userId: lockedBy, username: lockedByName, color }: any) => {
            activeLocks.current[cellRef] = { userId: lockedBy, username: lockedByName, color };
        });

        socket.on("cell-unlocked", ({ cellRef }: { cellRef: string }) => {
            delete activeLocks.current[cellRef];
        });

        socket.on("lock-denied", ({ lockedBy }: { cellRef: string, lockedBy: string }) => {
            setLockDenied(`Cell is locked by ${lockedBy}`);
            setTimeout(() => setLockDenied(null), 3000);
        });
    };

    const handleOp = useCallback((ops: Op[]) => {
        if (isApplyingRemoteOp.current) return;

        const lockedByOther = ops.some((op: any) => {
            if (!op.path) return false;
            const row = op.path[2];
            const col = op.path[3];
            if (row === undefined || col === undefined) return false;
            const cellRef = `${getActiveSheetId()}:${row}:${col}`;
            const lock = activeLocks.current[cellRef];
            return lock && lock.userId !== currentUserRef.current?.userId;
        });

        if (lockedByOther) {
            isApplyingRemoteOp.current = true;
            workbookRef.current?.updateSheet(dataRef.current);
            isApplyingRemoteOp.current = false;
            setLockDenied("That cell is locked by another user");
            setTimeout(() => setLockDenied(null), 3000);
            return;
        }

        const socket = getSocket();
        socket.emit("cell-change", { sheetId: parseInt(id), ops });

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

    const openRenameModal = () => {
        setRenameName(sheetName);
        setRenameError(null);
        setShowRenameModal(true);
    };

    const handleRename = async () => {
        const trimmed = renameName.trim();
        if (!trimmed) { setRenameError("Name cannot be empty"); return; }
        if (trimmed === sheetName) { setShowRenameModal(false); return; }
        setRenaming(true);
        setRenameError(null);
        try {
            const res = await fetch(`/api/sheets/${id}/rename`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            const body = await res.json();
            if (!res.ok) { setRenameError(body.error || "Rename failed"); return; }
            setSheetName(trimmed);
            setShowRenameModal(false);
        } catch {
            setRenameError("Something went wrong");
        } finally {
            setRenaming(false);
        }
    };

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

    const handleSnapshot = async () => {
        setSnapshotting(true);
        setSnapshotStatus("idle");
        try {
            const res = await fetch(`/api/sheets/${id}/snapshot`, {
                method: "POST",
                credentials: "include",
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Snapshot failed");
            setSnapshotStatus("saved");
            setTimeout(() => setSnapshotStatus("idle"), 2000);
            // Refresh version list if panel is open
            if (showVersionPanel) fetchVersions();
        } catch (err) {
            console.error("Snapshot error:", err);
            setSnapshotStatus("error");
        } finally {
            setSnapshotting(false);
        }
    };

    const handleRestore = async (version: number) => {
        if (!confirm(`Restore sheet to version ${version}? Current unsaved changes will be lost.`)) return;
        setRestoring(version);
        setRestoreStatus("idle");
        try {
            const res = await fetch(`/api/sheets/${id}/snapshot/restore`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ version }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Restore failed");

            setRestoreStatus("restored");
            setTimeout(() => setRestoreStatus("idle"), 2000);

            // Reload sheet data into the workbook
            const sheetRes = await fetch(`/api/sheets/${id}`, { credentials: "include" });
            if (sheetRes.ok) {
                const sheet = await sheetRes.json();
                if (sheet.SheetData?.data && Array.isArray(sheet.SheetData.data)) {
                    const restored = sheet.SheetData.data.map((s: any) => {
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
                    workbookRef.current?.updateSheet(restored);
                }
            }
        } catch (err) {
            console.error("Restore error:", err);
            setRestoreStatus("error");
        } finally {
            setRestoring(null);
        }
    };

    const handleToggleVersionPanel = () => {
        const next = !showVersionPanel;
        setShowVersionPanel(next);
        if (next) fetchVersions();
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
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

            {/* ── Toolbar ── */}
            <div style={{
                padding: "8px 16px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex", alignItems: "center", gap: "12px",
                background: "white", flexShrink: 0,
            }}>
                <button onClick={() => router.push("/dashboard")} style={{
                    padding: "6px 16px", background: "white", color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: "6px",
                    cursor: "pointer", fontWeight: 500,
                }}>
                    ← Dashboard
                </button>

                {/* Sheet name + rename trigger */}
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#111827" }}>
                    {sheetName}
                </span>
                {canSnapshotOrRestore && (
                    <button onClick={openRenameModal} style={{
                        padding: "4px 10px", background: "white", color: "#374151",
                        border: "1px solid #d1d5db", borderRadius: "6px",
                        cursor: "pointer", fontSize: "12px", fontWeight: 500,
                    }}>
                        ✏️ Rename
                    </button>
                )}

                {/* Save — hidden for VIEWER */}
                {canEdit && (
                    <button onClick={handleSave} disabled={saving} style={{
                        padding: "6px 16px",
                        background: saving ? "#9ca3af" : "#2563eb",
                        color: "white", border: "none", borderRadius: "6px",
                        cursor: saving ? "not-allowed" : "pointer", fontWeight: 500,
                    }}>
                        {saving ? "Saving..." : "Save"}
                    </button>
                )}

                {saveStatus === "saved" && <span style={{ color: "#16a34a", fontSize: "14px" }}>✔ Saved</span>}
                {saveStatus === "error" && <span style={{ color: "#dc2626", fontSize: "14px" }}>✗ Save failed</span>}

                {/* Snapshot — OWNER / ADMIN only */}
                {canSnapshotOrRestore && (
                    <button onClick={handleSnapshot} disabled={snapshotting} style={{
                        padding: "6px 16px",
                        background: snapshotting ? "#9ca3af" : "#7c3aed",
                        color: "white", border: "none", borderRadius: "6px",
                        cursor: snapshotting ? "not-allowed" : "pointer", fontWeight: 500,
                    }}>
                        {snapshotting ? "Saving..." : "📷 Snapshot"}
                    </button>
                )}

                {snapshotStatus === "saved" && <span style={{ color: "#16a34a", fontSize: "14px" }}>✔ Snapshot saved</span>}
                {snapshotStatus === "error" && <span style={{ color: "#dc2626", fontSize: "14px" }}>✗ Snapshot failed</span>}

                {/* Version history toggle — visible to all */}
                <button onClick={handleToggleVersionPanel} style={{
                    padding: "6px 16px",
                    background: showVersionPanel ? "#f3f4f6" : "white",
                    color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: "6px",
                    cursor: "pointer", fontWeight: 500,
                }}>
                    🕓 History {showVersionPanel ? "▲" : "▼"}
                </button>

                {restoreStatus === "restored" && <span style={{ color: "#16a34a", fontSize: "14px" }}>✔ Restored</span>}
                {restoreStatus === "error" && <span style={{ color: "#dc2626", fontSize: "14px" }}>✗ Restore failed</span>}

                {lockDenied && (
                    <span style={{
                        background: "#fef2f2", border: "1px solid #fecaca",
                        color: "#dc2626", fontSize: "13px",
                        padding: "4px 12px", borderRadius: "6px",
                    }}>
                        🔒 {lockDenied}
                    </span>
                )}

                {/* Presence avatars */}
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

            {/* ── Version History Panel ── */}
            {showVersionPanel && (
                <div style={{
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    padding: "12px 16px",
                    flexShrink: 0,
                    maxHeight: "220px",
                    overflowY: "auto",
                }}>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#374151", marginBottom: "8px" }}>
                        Version History
                    </div>

                    {versionsLoading && (
                        <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading versions...</p>
                    )}

                    {!versionsLoading && versions.length === 0 && (
                        <p style={{ fontSize: "13px", color: "#6b7280" }}>
                            No snapshots yet.{canSnapshotOrRestore ? " Click 📷 Snapshot to save one." : ""}
                        </p>
                    )}

                    {!versionsLoading && versions.length > 0 && (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                            <thead>
                                <tr style={{ color: "#6b7280", textAlign: "left" }}>
                                    <th style={{ padding: "4px 12px 4px 0", fontWeight: 600 }}>Version</th>
                                    <th style={{ padding: "4px 12px 4px 0", fontWeight: 600 }}>Saved by</th>
                                    <th style={{ padding: "4px 12px 4px 0", fontWeight: 600 }}>Date</th>
                                    {canSnapshotOrRestore && (
                                        <th style={{ padding: "4px 0", fontWeight: 600 }}>Action</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map((v) => (
                                    <tr key={v.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                                        <td style={{ padding: "6px 12px 6px 0", color: "#1d4ed8", fontWeight: 600 }}>
                                            v{v.version}
                                        </td>
                                        <td style={{ padding: "6px 12px 6px 0", color: "#374151" }}>
                                            {v.User.username}
                                        </td>
                                        <td style={{ padding: "6px 12px 6px 0", color: "#6b7280" }}>
                                            {formatDate(v.createdAt)}
                                        </td>
                                        {canSnapshotOrRestore && (
                                            <td style={{ padding: "6px 0" }}>
                                                <button
                                                    onClick={() => handleRestore(v.version)}
                                                    disabled={restoring === v.version}
                                                    style={{
                                                        padding: "3px 12px",
                                                        background: restoring === v.version ? "#9ca3af" : "#059669",
                                                        color: "white", border: "none", borderRadius: "4px",
                                                        cursor: restoring === v.version ? "not-allowed" : "pointer",
                                                        fontSize: "12px", fontWeight: 500,
                                                    }}
                                                >
                                                    {restoring === v.version ? "Restoring..." : "Restore"}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

        {/* ── Workbook ── */}
        <div style={{ flex: 1 }}>
            <Workbook
                ref={workbookRef}
                data={data}
                onChange={(updatedData) => {
                    if (!dataLoaded.current) return;
                    // Defer setState out of FortuneSheet's render cycle.
                    // Fixes "Cannot update a component while rendering a different
                    // component" triggered by sheet rename and similar internal ops.
                    dataRef.current = updatedData;
                    if (onChangeTimer.current) clearTimeout(onChangeTimer.current);
                    onChangeTimer.current = setTimeout(() => {
                        setData(updatedData);
                    }, 0);
                }}
                onOp={handleOp}
            />
        </div>

        {/* ── Rename modal ── */}
            {showRenameModal && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 2000,
                }}>
                    <div style={{
                        background: "white", borderRadius: "8px",
                        padding: "24px", width: "380px",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                    }}>
                        <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                            Rename Sheet
                        </h3>
                        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                            Current name: <strong>{sheetName}</strong>
                        </p>
                        <input
                            type="text"
                            value={renameName}
                            onChange={(e) => { setRenameName(e.target.value); setRenameError(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setShowRenameModal(false); }}
                            autoFocus
                            maxLength={100}
                            placeholder="Enter new name"
                            style={{
                                width: "100%", padding: "8px 12px",
                                border: renameError ? "1px solid #dc2626" : "1px solid #d1d5db",
                                borderRadius: "6px", fontSize: "14px",
                                outline: "none", boxSizing: "border-box" as const,
                                marginBottom: renameError ? "6px" : "20px",
                            }}
                        />
                        {renameError && (
                            <p style={{ color: "#dc2626", fontSize: "12px", marginBottom: "16px" }}>
                                {renameError}
                            </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                                onClick={() => setShowRenameModal(false)}
                                disabled={renaming}
                                style={{
                                    padding: "7px 16px", borderRadius: "6px",
                                    border: "1px solid #d1d5db", background: "white",
                                    cursor: "pointer", fontSize: "14px",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={renaming}
                                style={{
                                    padding: "7px 16px", borderRadius: "6px",
                                    border: "none",
                                    background: renaming ? "#9ca3af" : "#2563eb",
                                    color: "white",
                                    cursor: renaming ? "not-allowed" : "pointer",
                                    fontSize: "14px", fontWeight: 500,
                                }}
                            >
                                {renaming ? "Renaming..." : "OK"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}