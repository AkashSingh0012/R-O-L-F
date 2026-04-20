"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const response = await fetch("/api/Auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      router.push("/dashboard"); 
    } else {
      alert("Login Failed"); 
    }
    setLoading(false);
  };

  return (
    <div className="root">
      <form onSubmit={handleSubmit}>
        <label>UserName</label>
        <input type="text" name="UID" required />
        
        <label>PassWord</label>
        <input type="password" name="PWD" required />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "SUBMIT"}
        </button>
      </form>
    </div>
  );
}