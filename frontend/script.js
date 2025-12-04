const API_URL = "https://saksnummer.saksnummergenerator.workers.dev"; // Fixed API endpoint

const generateBtn = document.getElementById("generate");
const peekBtn = document.getElementById("peek");
const out = document.getElementById("output");

function fmtResult(r) {
    const counter = r.counter ?? r.next ?? r.lastIssued ?? 0;
    return `${r.caseNumber}  (år=${r.year}, teller=${String(counter).padStart(6,"0")})`;
}

async function call(path, opts = {}) {
    const url = `${API_URL}${path}`;

    try {
        const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json" } });

        if (!res.ok) {
            const message = (await res.text()) || res.statusText;
            throw new Error(`Feil ${res.status}${message ? `: ${message}` : ""}`);
        }

        return res.json();
    } catch (e) {
        const details = e instanceof Error ? e.message : String(e);
        throw new Error(`Kunne ikke kontakte API-et (${url}). ${details}. Sjekk URL-en og nettverkstilgang.`);
    }
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
