"use client";

import { useState } from "react";
import Link from "next/link";
import ShareDialog from "./ShareDialog";
import PermissionsManager from "./PermissionsManager";

interface Sheet {
    id: number;
    name: string;
    createdAt: string;
    User: { username: string };
}

interface Props {
    workbooks: Sheet[];
    isAdmin: boolean;
}

export default function DashboardClient({ workbooks, isAdmin }: Props) {
    const [shareSheet, setShareSheet] = useState<Sheet | null>(null);
    const [permSheet, setPermSheet] = useState<Sheet | null>(null);

    return (
        <>
            {workbooks.length === 0 && (
                <p className="text-gray-400 text-sm">No sheets yet. Create one!</p>
            )}
            {workbooks.map((sheet) => (
                <div key={sheet.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "8px 4px",
                }}>
                    <Link href={`/dashboard/sheet/${sheet.id}`} style={{ flex: 1, textDecoration: "none" }}>
                        <div className="hover:bg-gray-100 cursor-pointer rounded p-2">
                            <p className="font-medium text-gray-800">{sheet.name}</p>
                            <p className="text-xs text-gray-400">
                                Created {new Date(sheet.createdAt).toLocaleDateString()}
                                {isAdmin && (
                                    <span className="ml-2 text-blue-400">
                                        by {sheet.User.username}
                                    </span>
                                )}
                            </p>
                        </div>
                    </Link>

                    <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
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
                    </div>
                </div>
            ))}

            {shareSheet && (
                <ShareDialog
                    sheetId={shareSheet.id}
                    sheetName={shareSheet.name}
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
        </>
    );
}