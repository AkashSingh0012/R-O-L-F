"use client";

import { useEffect, useState } from "react";

interface Permission {
    id: number;
    userId: string;
    role: string;
    User: { id: string; username: string; email: string };
}

interface PermissionsManagerProps {
    sheetId: number;
    sheetName: string;
    onClose: () => void;
}

export default function PermissionsManager({ sheetId, sheetName, onClose }: PermissionsManagerProps) {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sheets/${sheetId}/permissions`, {credentials: "include"});
            const body = await res.json();
            if (!res.ok) {
                setError(body.error || "Failed to load");
            } else {
                // Filter out the OWNER row — they shouldn't be editable
                setPermissions(body.filter((p: Permission) => p.role !== "OWNER"));
            }
        } catch {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPermissions(); }, [sheetId]);

    const handleRoleChange = async (userId: string, role: string) => {
        const res = await fetch(`/api/sheets/${sheetId}/permissions`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role }),
        });
        if (res.ok) fetchPermissions();
    };

    const handleRevoke = async (userId: string) => {
        const res = await fetch(`/api/sheets/${sheetId}/permissions`, {
            method: "DELETE",
            credentials:"include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        });
        if (res.ok) fetchPermissions();
    };

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
        }}>
            <div style={{
                background: "white", borderRadius: "8px",
                padding: "24px", width: "480px", maxHeight: "70vh",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                display: "flex", flexDirection: "column",
            }}>
                <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                    Permissions — "{sheetName}"
                </h3>
                <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                    Manage who has access to this sheet
                </p>

                <div style={{ overflowY: "auto", flex: 1 }}>
                    {loading && <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading...</p>}
                    {error && <p style={{ color: "#dc2626", fontSize: "14px" }}>{error}</p>}
                    {!loading && permissions.length === 0 && (
                        <p style={{ color: "#6b7280", fontSize: "14px" }}>
                            No one else has access to this sheet yet.
                        </p>
                    )}
                    {permissions.map((p) => (
                        <div key={p.id} style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0", borderBottom: "1px solid #f3f4f6",
                            gap: "8px",
                        }}>
                            <div>
                                <p style={{ fontWeight: 500, fontSize: "14px" }}>{p.User.username}</p>
                                <p style={{ fontSize: "12px", color: "#9ca3af" }}>{p.User.email}</p>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <select
                                    value={p.role}
                                    onChange={(e) => handleRoleChange(p.User.id, e.target.value)}
                                    style={{
                                        padding: "4px 8px", borderRadius: "4px",
                                        border: "1px solid #d1d5db", fontSize: "13px",
                                    }}
                                >
                                    <option value="VIEWER">Viewer</option>
                                    <option value="EDITOR">Editor</option>
                                </select>
                                <button
                                    onClick={() => handleRevoke(p.User.id)}
                                    style={{
                                        padding: "4px 10px", borderRadius: "4px",
                                        border: "none", background: "#fee2e2",
                                        color: "#dc2626", cursor: "pointer", fontSize: "13px",
                                    }}
                                >
                                    Revoke
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button onClick={onClose} style={{
                        padding: "7px 16px", borderRadius: "6px",
                        border: "1px solid #d1d5db", background: "white",
                        cursor: "pointer", fontSize: "14px",
                    }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}