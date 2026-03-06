"use client";

import React from "react";

export default function Page() {
  return (
    <div className="root">
      <div>Navigation</div>

      <div>Segments</div>

      <div>
        <form method="POST" action="/api/Auth/login">
          
          <label>UserName</label>
          <input 
            type="text"
            name="UID"
            className="UID"
            required
          />

          <label>PassWord</label>
          <input 
            type="password"
            name="PWD"
            className="PWD"
            required
          />

          <button type="submit" className="Submit">
            SUBMIT
          </button>

        </form>
      </div>
    </div>
  );
}