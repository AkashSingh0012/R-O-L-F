"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ShareDialog from "./ShareDialog";
import PermissionsManager from "./PermissionsManager";

interface Sheet {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    snapshotAt: string | null;
    User: { username: string };
    userSheetRole: string | null;
}

interface DeletedSheet {
    id: number;
    name: string;
    createdAt: string;
    deletedAt: string | null;
    User: { username: string };
}

interface Props {
    workbooks: Sheet[];
    deletedWorkbooks: DeletedSheet[];
    isAdmin: boolean;
}

const roleBadgeStyle = (role: string | null) => ({
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600 as const,
    background: role === "OWNER" ? "#dbeafe" : role === "EDITOR" ? "#d1fae5" : "#f3f4f6",
    color: role === "OWNER" ? "#1d4ed8" : role === "EDITOR" ? "#065f46" : "#6b7280",
});

const btnStyle = (variant: "default" | "danger" | "primary" | "purple" = "default") => ({
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500 as const,
    cursor: "pointer" as const,
    border: variant === "danger" ? "none" : "1px solid #d1d5db",
    background: variant === "danger" ? "#fee2e2" : variant === "primary" ? "#2563eb" : variant === "purple" ? "#7c3aed" : "white",
    color: variant === "danger" ? "#dc2626" : variant === "primary" || variant === "purple" ? "white" : "#374151",
});

export default function DashboardClient({ workbooks, deletedWorkbooks = [], isAdmin }: Props) {
    const [shareSheet, setShareSheet] = useState<Sheet | null>(null);
    const [permSheet, setPermSheet] = useState<Sheet | null>(null);
    const [deleteSheet, setDeleteSheet] = useState<Sheet | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Snapshot
    const [snapshotting, setSnapshotting] = useState<number | null>(null);
    const [restoringSnapshot, setRestoringSnapshot] = useState<number | null>(null);

    // Recycle bin
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [restoring, setRestoring] = useState<number | null>(null);
    const [permDeleting, setPermDeleting] = useState<number | null>(null);

    // Rename
    const [renameSheet, setRenameSheet] = useState<Sheet | null>(null);
    const [renameName, setRenameName] = useState("");
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);

    const router = useRouter();

    // ── Delete (soft) ──
    const handleDelete = async () => {
        if (!deleteSheet) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/sheets/${deleteSheet.id}/delete`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setDeleteSheet(null);
                router.refresh();
            } else {
                const body = await res.json();
                alert(body.error || "Failed to delete");
            }
        } catch {
            alert("Something went wrong");
        } finally {
            setDeleting(false);
        }
    };

    // ── Create snapshot ──
    const handleSnapshot = async (sheetId: number) => {
        setSnapshotting(sheetId);
        try {
            const res = await fetch(`/api/sheets/${sheetId}/snapshot`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                alert("Snapshot created successfully");
                router.refresh();
            } else {
                const body = await res.json();
                alert(body.error || "Snapshot failed");
            }
        } catch {
            alert("Something went wrong");
        } finally {
            setSnapshotting(null);
        }
    };

    // ── Restore snapshot ──
    const handleRestoreSnapshot = async (sheet: Sheet) => {
        if (!sheet.snapshotAt) {
            alert("No snapshot exists for this sheet yet.");
            return;
        }
        if (!confirm(`Restore to snapshot from ${new Date(sheet.snapshotAt).toLocaleString("en-GB")}?\n\nCurrent data will be overwritten.`)) return;
        setRestoringSnapshot(sheet.id);
        try {
            const res = await fetch(`/api/sheets/${sheet.id}/snapshot/restore`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) router.refresh();
            else {
                const body = await res.json();
                alert(body.error || "Restore failed");
            }
        } catch {
            alert("Something went wrong");
        } finally {
            setRestoringSnapshot(null);
        }
    };

    // ── Restore from recycle bin ──
    const handleRestore = async (sheetId: number) => {
        setRestoring(sheetId);
        try {
            const res = await fetch(`/api/sheets/${sheetId}/restore`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) router.refresh();
            else {
                const body = await res.json();
                alert(body.error || "Restore failed");
            }
        } catch {
            alert("Something went wrong");
        } finally {
            setRestoring(null);
        }
    };

    // ── Permanent delete ──
    const handlePermanentDelete = async (sheetId: number) => {
        if (!confirm("Permanently delete this sheet? This cannot be undone.")) return;
        setPermDeleting(sheetId);
        try {
            const res = await fetch(`/api/sheets/${sheetId}/permanent-delete`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) router.refresh();
            else {
                const body = await res.json();
                alert(body.error || "Failed to permanently delete");
            }
        } catch {
            alert("Something went wrong");
        } finally {
            setPermDeleting(null);
        }
    };

    // ── Open rename modal ──
    const openRename = (sheet: Sheet) => {
        setRenameSheet(sheet);
        setRenameName(sheet.name);
        setRenameError(null);
    };

    // ── Submit rename ──
    const handleRename = async () => {
        if (!renameSheet) return;
        const trimmed = renameName.trim();
        if (!trimmed) { setRenameError("Name cannot be empty"); return; }
        if (trimmed === renameSheet.name) { setRenameSheet(null); return; }

        setRenaming(true);
        setRenameError(null);
        try {
            const res = await fetch(`/api/sheets/${renameSheet.id}/rename`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            const body = await res.json();
            if (!res.ok) {
                setRenameError(body.error || "Rename failed");
                return;
            }
            setRenameSheet(null);
            router.refresh();
        } catch {
            setRenameError("Something went wrong");
        } finally {
            setRenaming(false);
        }
    };

    return (
        <>
            {/* ── Active workbooks ── */}
            {workbooks.length === 0 && (
                <p className="text-gray-400 text-sm">No sheets yet. Create one!</p>
            )}
            {workbooks.map((sheet) => {
                const isOwner = isAdmin || sheet.userSheetRole === "OWNER";
                return (
                    <div key={sheet.id} style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #f3f4f6",
                        padding: "8px 4px",
                    }}>
                        <Link href={`/dashboard/sheet/${sheet.id}`} style={{ flex: 1, textDecoration: "none" }}>
                            <div className="hover:bg-gray-100 cursor-pointer rounded p-2">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <p className="font-medium text-gray-800">{sheet.name}</p>
                                    {!isAdmin && sheet.userSheetRole && (
                                        <span style={roleBadgeStyle(sheet.userSheetRole)}>
                                            {sheet.userSheetRole}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400">
                                    Created {new Date(sheet.createdAt).toLocaleDateString("en-GB")}
                                    {isAdmin && (
                                        <span className="ml-2 text-blue-400">
                                            by {sheet.User.username}
                                        </span>
                                    )}
                                </p>
                                {sheet.snapshotAt && isOwner && (
                                    <p className="text-xs" style={{ color: "#7c3aed", marginTop: "2px" }}>
                                        📷 Snapshot: {new Date(sheet.snapshotAt).toLocaleString("en-GB")}
                                    </p>
                                )}
                            </div>
                        </Link>

                        <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
                            {isOwner && (
                                <>
                                    <button onClick={() => openRename(sheet)} style={btnStyle()}>
                                        ✏️ Rename
                                    </button>
                                    <button onClick={() => setShareSheet(sheet)} style={btnStyle()}>
                                        Share
                                    </button>
                                    <button onClick={() => setPermSheet(sheet)} style={btnStyle()}>
                                        Permissions
                                    </button>
                                    <button
                                        onClick={() => handleSnapshot(sheet.id)}
                                        disabled={snapshotting === sheet.id}
                                        style={btnStyle("purple")}
                                        title="Save current state as snapshot"
                                    >
                                        {snapshotting === sheet.id ? "Saving..." : "📷 Snapshot"}
                                    </button>
                                    <button
                                        onClick={() => handleRestoreSnapshot(sheet)}
                                        disabled={restoringSnapshot === sheet.id || !sheet.snapshotAt}
                                        style={{
                                            ...btnStyle(),
                                            opacity: !sheet.snapshotAt ? 0.4 : 1,
                                            cursor: !sheet.snapshotAt ? "not-allowed" : "pointer",
                                        }}
                                        title={sheet.snapshotAt
                                            ? `Restore to ${new Date(sheet.snapshotAt).toLocaleString("en-GB")}`
                                            : "No snapshot yet"}
                                    >
                                        {restoringSnapshot === sheet.id ? "Restoring..." : "↩ Restore"}
                                    </button>
                                    <button onClick={() => setDeleteSheet(sheet)} style={btnStyle("danger")}>
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ── Recycle bin toggle ── */}
            {deletedWorkbooks.length > 0 && (
                <div style={{ marginTop: "32px" }}>
                    <button
                        onClick={() => setShowRecycleBin(v => !v)}
                        style={{
                            fontSize: "13px", color: "#6b7280",
                            background: "none", border: "none",
                            cursor: "pointer", padding: "4px 0",
                            display: "flex", alignItems: "center", gap: "6px",
                        }}
                    >
                        🗑 {showRecycleBin ? "Hide" : "Show"} Recycle Bin ({deletedWorkbooks.length})
                    </button>

                    {showRecycleBin && (
                        <div style={{
                            marginTop: "12px", border: "1px solid #f3f4f6",
                            borderRadius: "8px", overflow: "hidden",
                        }}>
                            {deletedWorkbooks.map((sheet) => (
                                <div key={sheet.id} style={{
                                    display: "flex", alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "10px 12px",
                                    borderBottom: "1px solid #f9fafb",
                                    background: "#fafafa",
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 500, fontSize: "14px", color: "#6b7280" }}>
                                            {sheet.name}
                                        </p>
                                        <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                                            Deleted {new Date(sheet.deletedAt!).toLocaleDateString("en-GB")}
                                            {isAdmin && ` · by ${sheet.User.username}`}
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button
                                            onClick={() => handleRestore(sheet.id)}
                                            disabled={restoring === sheet.id}
                                            style={btnStyle("primary")}
                                        >
                                            {restoring === sheet.id ? "Restoring..." : "Restore"}
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(sheet.id)}
                                            disabled={permDeleting === sheet.id}
                                            style={btnStyle("danger")}
                                        >
                                            {permDeleting === sheet.id ? "Deleting..." : "Delete Forever"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Dialogs ── */}
            {shareSheet && (
                <ShareDialog
                    sheetId={shareSheet.id}
                    sheetName={shareSheet.name}
                    isOwner={isAdmin || shareSheet.userSheetRole === "OWNER"}
                    onClose={() => setShareSheet(null)}
                />
            )}

            {permSheet && (
                <PermissionsManager
                    sheetId={permSheet.id}
                    sheetName={permSheet.name}
                    onClose={() => setPermSheet(null)}
                />
            )}

            {/* ── Rename modal ── */}
            {renameSheet && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1000,
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
                            Current name: <strong>{renameSheet.name}</strong>
                        </p>
                        <input
                            type="text"
                            value={renameName}
                            onChange={(e) => { setRenameName(e.target.value); setRenameError(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenameSheet(null); }}
                            autoFocus
                            maxLength={100}
                            placeholder="Enter new name"
                            style={{
                                width: "100%", padding: "8px 12px",
                                border: renameError ? "1px solid #dc2626" : "1px solid #d1d5db",
                                borderRadius: "6px", fontSize: "14px",
                                outline: "none", boxSizing: "border-box",
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
                                onClick={() => setRenameSheet(null)}
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

            {/* ── Delete confirmation ── */}
            {deleteSheet && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1000,
                }}>
                    <div style={{
                        background: "white", borderRadius: "8px",
                        padding: "24px", width: "360px",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                    }}>
                        <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
                            Delete "{deleteSheet.name}"?
                        </h3>
                        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
                            The sheet will be moved to the Recycle Bin. You can restore it from there.
                        </p>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                                onClick={() => setDeleteSheet(null)}
                                disabled={deleting}
                                style={{
                                    padding: "7px 16px", borderRadius: "6px",
                                    border: "1px solid #d1d5db", background: "white",
                                    cursor: "pointer", fontSize: "14px",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{
                                    padding: "7px 16px", borderRadius: "6px",
                                    border: "none",
                                    background: deleting ? "#9ca3af" : "#dc2626",
                                    color: "white",
                                    cursor: deleting ? "not-allowed" : "pointer",
                                    fontSize: "14px", fontWeight: 500,
                                }}
                            >
                                {deleting ? "Deleting..." : "Move to Bin"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}