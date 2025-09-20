const DEFAULT_API_URL = "https://saksnummer.saksnummergenerator.workers.dev"; // e.g. "https://saksnummer.yourdomain.workers.dev"

const apiUrlInput = document.getElementById("apiUrl");
const saveUrlBtn = document.getElementById("saveUrl");
const generateBtn = document.getElementById("generate");
const peekBtn = document.getElementById("peek");
const out = document.getElementById("output");

const LS_KEY = "saksnummer_api_url";

function getApiUrl() {
    return localStorage.getItem(LS_KEY) || DEFAULT_API_URL;
}
function setApiUrl(url) {
    localStorage.setItem(LS_KEY, url.trim());
}

function fmtResult(r) {
    return `${r.caseNumber}  (år=${r.year}, teller=${String(r.counter).padStart(6,"0")})`;
}

async function call(path, opts = {}) {
    const base = getApiUrl();
    if (!base) { out.textContent = "Sett API-URL først."; return null; }
    const res = await fetch(`${base}${path}`, { ...opts, headers: { "Content-Type": "application/json" }});
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Feil ${res.status}: ${t}`);
    }
    return res.json();
}

generateBtn.addEventListener("click", async () => {
    out.textContent = "Genererer…";
    try {
        const r = await call("/api/next", { method: "POST" });
        out.textContent = fmtResult(r);
        // Auto-copy
        try { await navigator.clipboard.writeText(r.caseNumber); } catch {}
    } catch (e) {
        out.textContent = `Feil: ${e.message}`;
    }
});

peekBtn.addEventListener("click", async () => {
    out.textContent = "Henter status…";
    try {
        const r = await call("/api/peek");
        out.textContent = fmtResult(r);
    } catch (e) {
        out.textContent = `Feil: ${e.message}`;
    }
});

saveUrlBtn.addEventListener("click", () => {
    setApiUrl(apiUrlInput.value);
    out.textContent = "API-URL lagret.";
});

window.addEventListener("DOMContentLoaded", () => {
    apiUrlInput.value = getApiUrl();
});
