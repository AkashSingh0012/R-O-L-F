"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import type { Sheet } from "@fortune-sheet/core";
import "@fortune-sheet/react/dist/index.css";

const Workbook = dynamic(
    () => import("@fortune-sheet/react").then((m) => m.Workbook),
    { ssr: false }
);

interface SheetPageProps {
    params: Promise<{ id: string }>;
}

export default function SheetPage({ params }: SheetPageProps) {
    const { id } = use(params);
    const [data, setData] = useState<Sheet[]>([
        {
            name: "Sheet1",
            celldata: [],
            row: 50,
            column: 26,
        },
    ]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

    useEffect(() => {
        const fetchSheet = async () => {
            try {
                const res = await fetch(`/api/sheets/${id}`);
                if (!res.ok) {
                    const errorBody = await res.json();
                    console.error("API error:", res.status, errorBody);
                    throw new Error(errorBody.error || "Failed to load sheet");
                }

                const sheet = await res.json();

                // ✅ Restore full sheet object if saved data exists
                if (sheet.SheetData?.data) {
                    setData([{
                        ...sheet.SheetData.data, // restore full saved state
                        name: sheet.name,        // always use name from DB
                    }]);
                } else {
                    // Fresh empty sheet
                    setData([{
                        name: sheet.name,
                        celldata: [],
                        row: 50,
                        column: 26,
                    }]);
                }

            } catch (err) {
                setError("Could not load sheet.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSheet();
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus("idle");
        try {
            const res = await fetch(`/api/sheets/${id}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // ✅ Save the full sheet object, not just celldata
                body: JSON.stringify({ data: data[0] }),
            });

            if (!res.ok) {
                const errorBody = await res.json();
                console.error("Save API error:", res.status, errorBody);
                throw new Error(errorBody.error || "Save failed");
            }

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
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "white",
            }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: "6px 16px",
                        background: saving ? "#9ca3af" : "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: saving ? "not-allowed" : "pointer",
                        fontWeight: 500,
                    }}
                >
                    {saving ? "Saving..." : "Save"}
                </button>

                {saveStatus === "saved" && (
                    <span style={{ color: "#16a34a", fontSize: "14px" }}> Saved</span>
                )}
                {saveStatus === "error" && (
                    <span style={{ color: "#dc2626", fontSize: "14px" }}> Save failed</span>
                )}
            </div>

            <div style={{ flex: 1 }}>
                <Workbook
                    data={data}
                    onChange={(updatedData) => {
                        setData(updatedData);
                    }}
                />
            </div>
        </div>
    );
}