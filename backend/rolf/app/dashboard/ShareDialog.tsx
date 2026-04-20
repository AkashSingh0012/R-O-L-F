"use client";

import { useState } from "react";

interface ShareDialogProps {
    sheetId: number;
    sheetName: string;
    onClose: () => void;
}

export default function ShareDialog({ sheetId, sheetName, onClose }: ShareDialogProps) {
    const [username, setUsername] = useState("");
    const [role, setRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleShare = async () => {
        if (!username.trim()) return;
        setStatus("loading");
        setMessage("");

        try {
            const res = await fetch(`/api/sheets/${sheetId}/permissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim(), role }),
            });

            const body = await res.json();
            if (!res.ok) {
                setStatus("error");
                setMessage(body.error || "Failed to share");
            } else {
                setStatus("success");
                setMessage(`Successfully shared with ${username}`);
                setUsername("");
            }
        } catch {
            setStatus("error");
            setMessage("Something went wrong");
        }
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
                padding: "24px", width: "360px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
            }}>
                <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
                    Share "{sheetName}"
                </h3>
                <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                    Enter a username to grant access
                </p>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleShare()}
                    style={{
                        width: "100%", padding: "8px 12px",
                        border: "1px solid #d1d5db", borderRadius: "6px",
                        fontSize: "14px", marginBottom: "10px",
                        boxSizing: "border-box",
                    }}
                />

                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
                    style={{
                        width: "100%", padding: "8px 12px",
                        border: "1px solid #d1d5db", borderRadius: "6px",
                        fontSize: "14px", marginBottom: "16px",
                        boxSizing: "border-box",
                    }}
                >
                    <option value="VIEWER">Viewer — can view only</option>
                    <option value="EDITOR">Editor — can view and edit</option>
                </select>

                {message && (
                    <p style={{
                        fontSize: "13px", marginBottom: "12px",
                        color: status === "success" ? "#16a34a" : "#dc2626",
                    }}>
                        {status === "success" ? "✓" : "✗"} {message}
                    </p>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button onClick={onClose} style={{
                        padding: "7px 16px", borderRadius: "6px",
                        border: "1px solid #d1d5db", background: "white",
                        cursor: "pointer", fontSize: "14px",
                    }}>
                        Close
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={status === "loading" || !username.trim()}
                        style={{
                            padding: "7px 16px", borderRadius: "6px",
                            border: "none",
                            background: status === "loading" || !username.trim() ? "#9ca3af" : "#2563eb",
                            color: "white", cursor: status === "loading" ? "not-allowed" : "pointer",
                            fontSize: "14px", fontWeight: 500,
                        }}
                    >
                        {status === "loading" ? "Sharing..." : "Share"}
                    </button>
                </div>
            </div>
        </div>
    );
}