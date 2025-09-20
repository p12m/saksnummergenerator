export interface Env {
    COUNTER: DurableObjectNamespace;
    ADMIN_TOKEN: string; // set via wrangler secret
}

function currentYearFullOslo(): number {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "numeric" });
    return parseInt(fmt.format(new Date()), 10);
}

function year2Digits(y: number): string {
    return (y % 100).toString().padStart(2, "0");
}

function cors(res: Response, origin: string): Response {
    const hdrs = new Headers(res.headers);
    hdrs.set("Access-Control-Allow-Origin", origin);
    hdrs.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    hdrs.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    hdrs.set("Access-Control-Max-Age", "86400");
    return new Response(res.body, { status: res.status, headers: hdrs });
}

const ALLOWED_ORIGIN = "https://p12m.github.io";

type State = { year: number; counter: number }; // counter = last issued for that year

export class SaksnummerCounter {
    state: DurableObjectState;
    storage: DurableObjectStorage;

    constructor(state: DurableObjectState, _env: Env) {
        this.state = state;
        this.storage = state.storage;
    }

    private pad(n: number): string {
        return n.toString().padStart(6, "0");
    }

    private formatCaseNumber(year2: string, n: number): string {
        return `${year2}/${this.pad(n)}`;
    }

    private nextCounterFor(year: number, last: number): number {
        // If no issuances yet this year:
        if (last === 0) return year === 2025 ? 200 : 1;
        return last + 1;
    }

    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        const path = url.pathname;
        const nowYear = currentYearFullOslo();

        let state = (await this.storage.get<State>("state")) || { year: nowYear, counter: 0 };
        // Rollover on New Year (Oslo time)
        if (state.year !== nowYear) {
            state = { year: nowYear, counter: 0 };
            await this.storage.put("state", state);
        }

        if (req.method === "GET" && path === "/api/peek") {
            const year2 = year2Digits(state.year);
            const next = this.nextCounterFor(state.year, state.counter);
            const lastIssued = state.counter === 0 ? null : state.counter;
            return Response.json({
                year: year2,
                lastIssued,
                next,
                caseNumber: this.formatCaseNumber(year2, next)
            });
        }

        if (req.method === "POST" && path === "/api/next") {
            // compute next, persist as last
            const next = this.nextCounterFor(state.year, state.counter);
            state.counter = next;
            await this.storage.put("state", state);

            const year2 = year2Digits(state.year);
            return Response.json({
                year: year2,
                counter: state.counter,
                caseNumber: this.formatCaseNumber(year2, state.counter)
            });
        }

        if (req.method === "POST" && path === "/api/set") {
            // Admin-only: body { year:number, counter:number }
            if (req.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
                return new Response("Unauthorized", { status: 401 });
            }
            const body = await req.json().catch(() => ({}));
            const year = typeof body.year === "number" ? body.year : nowYear;
            const counter = typeof body.counter === "number" ? body.counter : 0;

            const newState: State = { year, counter };
            await this.storage.put("state", newState);

            const year2 = year2Digits(year);
            return Response.json({
                ok: true,
                year: year2,
                counter,
                caseNumber: `${year2}/${counter.toString().padStart(6, "0")}`
            });
        }

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204 });
        }

        return new Response("Not found", { status: 404 });
    }
}

// SINGLE default export with CORS wrapper and DO routing
export default {
    async fetch(req: Request, env: Env) {
        if (req.method === "OPTIONS") {
            return cors(new Response(null, { status: 204 }), ALLOWED_ORIGIN);
        }
        const id = env.COUNTER.idFromName("global");
        const stub = env.COUNTER.get(id);
        const res = await stub.fetch(req);
        return cors(res, ALLOWED_ORIGIN);
    }
};
