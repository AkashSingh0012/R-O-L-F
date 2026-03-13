"use client";

import { useState } from "react";
import CreateWorkbookModal from "./CreateWorkbookModal";

export default function Navbar() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <nav className="p-4 border-b flex justify-between">
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded">
          + Create New Workbook
        </button>
      </nav>
      {showModal && <CreateWorkbookModal onClose={() => setShowModal(false)} />}
    </>
  );
}