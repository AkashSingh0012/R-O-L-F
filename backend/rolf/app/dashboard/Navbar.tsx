"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateWorkbookModal from "./CreateWorkbookModal";

interface NavbarProps {
    role: string;
}

export default function Navbar({ role }: NavbarProps) {
    const [showModal, setShowModal] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/Auth/logout", { method: "POST" });
        router.push("/Auth");
    };

    return (
        <>
            <nav className="p-4 border-b flex justify-between items-center">
                <span className="font-bold text-lg">ROLF</span>
                <div className="flex gap-3">
                    {role === "ADMIN" && (
                        <button
                            onClick={() => router.push("/dashboard/activity")}
                            style={{
                                padding: "6px 16px",
                                background: "white",
                                color: "#374151",
                                border: "1px solid #d1d5db",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 500,
                                fontSize: "14px",
                            }}
                        >
                            Activity Feed
                        </button>
                    )}
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded"
                    >
                        + Create New Workbook
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 text-white px-4 py-2 rounded"
                    >
                        Logout
                    </button>
                </div>
            </nav>
            {showModal && <CreateWorkbookModal onClose={() => setShowModal(false)} />}
        </>
    );
}