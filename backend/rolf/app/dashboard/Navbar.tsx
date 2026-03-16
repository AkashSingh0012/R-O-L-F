"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateWorkbookModal from "./CreateWorkbookModal";

export default function Navbar() {
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