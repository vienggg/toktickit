import React, { useState } from "react";
import { checkSystem, Category } from "../api";

type UiState = "idle" | "loading" | "success" | "error";

export default function Lab1App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && <p className="mt-3">Checking system status…</p>}

      {state === "success" && (
        <div className="mt-3">
          <span className="badge bg-success me-2">Online</span>
          <ul className="list-group mt-2">
            {categories.map((c) => (
              <li key={c.id} className="list-group-item">{c.name}</li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <span className="badge bg-danger me-2">Offline</span>
          <p className="text-danger mt-1">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
