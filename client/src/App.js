import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { checkSystem } from "./api.js";
export default function App() {
    const [state, setState] = useState("idle");
    const [categories, setCategories] = useState([]);
    const [errorMsg, setErrorMsg] = useState("");
    async function handleCheck() {
        setState("loading");
        try {
            const result = await checkSystem();
            setCategories(result.categories);
            setState("success");
        }
        catch (e) {
            setErrorMsg(e instanceof Error ? e.message : "Unknown error");
            setState("error");
        }
    }
    return (_jsxs("div", { className: "container py-5", style: { maxWidth: 640 }, children: [_jsxs("h1", { className: "h3 mb-4", children: ["TokTickIT ", _jsx("span", { className: "text-success", children: "IT Service Desk" })] }), _jsx("button", { className: "btn btn-success", onClick: handleCheck, disabled: state === "loading", children: state === "loading" ? "Loading…" : "Check System" }), state === "loading" && _jsx("p", { className: "mt-3", children: "Checking system status\u2026" }), state === "success" && (_jsxs("div", { className: "mt-3", children: [_jsx("span", { className: "badge bg-success me-2", children: "Online" }), _jsx("ul", { className: "list-group mt-2", children: categories.map((c) => (_jsx("li", { className: "list-group-item", children: c.name }, c.id))) })] })), state === "error" && (_jsxs("div", { className: "mt-3", children: [_jsx("span", { className: "badge bg-danger me-2", children: "Offline" }), _jsx("p", { className: "text-danger mt-1", children: errorMsg })] }))] }));
}
