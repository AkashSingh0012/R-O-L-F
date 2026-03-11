"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateWorkbookModal({ onClose }: { onClose: () => void }) {
  const [sheetName, setSheetName] = useState("");
  const router = useRouter();

  const handleCreate = async () => {
    const res = await fetch("/api/sheets/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sheetName }),
    });

    if (res.ok) {
      router.refresh(); // Tells Next.js to re-fetch the data in your Dashboard
      onClose();
    } else {
      alert("Failed to create workbook");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-80">
        <h3 className="text-lg font-bold mb-4">Create New Workbook</h3>
        <input 
          className="border p-2 w-full mb-4"
          placeholder="Sheet Name"
          value={sheetName}
          onChange={(e) => setSheetName(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-500">Cancel</button>
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
        </div>
      </div>
    </div>
  );
}