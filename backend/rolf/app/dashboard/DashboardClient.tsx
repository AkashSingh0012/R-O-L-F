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
    User: { username: string };
    userSheetRole: string | null;
}

interface Props {
    workbooks: Sheet[];
    isAdmin: boolean;
}

const roleBadgeStyle = (role: string | null) => ({
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    background: role === "OWNER" ? "#dbeafe" : role === "EDITOR" ? "#d1fae5" : "#f3f4f6",
    color: role === "OWNER" ? "#1d4ed8" : role === "EDITOR" ? "#065f46" : "#6b7280",
});

export default function DashboardClient({ workbooks, isAdmin }: Props) {
    const [shareSheet, setShareSheet] = useState<Sheet | null>(null);
    const [permSheet, setPermSheet] = useState<Sheet | null>(null);
    const [deleteSheet, setDeleteSheet] = useState<Sheet | null>(null);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

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

    return (
        <>
            {workbooks.length === 0 && (
                <p className="text-gray-400 text-sm">No sheets yet. Create one!</p>
            )}
            {workbooks.map((sheet) => {
                const isOwner = isAdmin || sheet.userSheetRole === "OWNER";

                return (
                    <div key={sheet.id} style={{
                        display: "flex",
                        alignItems: "center",
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
                            </div>
                        </Link>

                        <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
                            {isOwner && (
                                <>
                                    <button
                                        onClick={() => setShareSheet(sheet)}
                                        style={{
                                            padding: "4px 10px", borderRadius: "4px",
                                            border: "1px solid #d1d5db", background: "white",
                                            cursor: "pointer", fontSize: "12px", fontWeight: 500,
                                            color: "#374151",
                                        }}
                                    >
                                        Share
                                    </button>
                                    <button
                                        onClick={() => setPermSheet(sheet)}
                                        style={{
                                            padding: "4px 10px", borderRadius: "4px",
                                            border: "1px solid #d1d5db", background: "white",
                                            cursor: "pointer", fontSize: "12px", fontWeight: 500,
                                            color: "#374151",
                                        }}
                                    >
                                        Permissions
                                    </button>
                                    <button
                                        onClick={() => setDeleteSheet(sheet)}
                                        style={{
                                            padding: "4px 10px", borderRadius: "4px",
                                            border: "none", background: "#fee2e2",
                                            cursor: "pointer", fontSize: "12px", fontWeight: 500,
                                            color: "#dc2626",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

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

            {deleteSheet && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.5)",
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
                            This will permanently delete the sheet and all its data. This action cannot be undone.
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
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}