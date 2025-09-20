export interface Env {
    COUNTER: DurableObjectNamespace;
    ADMIN_TOKEN: string; // set via wrangler secret
}

function currentYearShortOslo(): string {
    // e.g., "25"
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "2-digit" });
    return fmt.format(new Date());
}

function currentYearFullOslo(): number {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", year: "numeric" });
    return parseInt(fmt.format(new Date()), 10);
}

type State = { year: number; counter: number }; // counter is last-issued number for that year

export class SaksnummerCounter {
    state: DurableObjectState;
    storage: DurableObjectStorage;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.storage = state.storage;
    }

    private pad(n: number): string {
        return n.toString().padStart(6, "0");
    }

    private formatCaseNumber(year2: string, n: number): string {
        return `${year2}/${this.pad(n)}`;
    }

    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        const path = url.pathname;

        if (req.method === "GET" && path === "/api/peek") {
            const state = (await this.storage.get<State>("state")) || { year: currentYearFullOslo(), counter: 0 };
            const year2 = (state.year % 100).toString().padStart(2, "0");
            const next = state.counter === 0 ? 1 : state.counter; // show last (or 0) – UI labels it clearly
            return Response.json({
                caseNumber: this.formatCaseNumber(year2, Math.max(1, next)),
                year: year2,
                counter: Math.max(1, next)
            });
        }

        if (req.method === "POST" && path === "/api/next") {
            const nowFullYear = currentYearFullOslo();
            let state = (await this.storage.get<State>("state")) || { year: nowFullYear, counter: 0 };

            // Rollover on New Year (Oslo time)
            if (state.year !== nowFullYear) {
                state = { year: nowFullYear, counter: 0 };
            }

            // First issuance special-case for 2025: start at 200
            if (state.counter === 0) {
                if (nowFullYear === 2025) {
                    state.counter = 200; // first issued will be 200
                } else {
                    state.counter = 1;   // first issued in new years ≥ 2026
                }
            } else {
                state.counter += 1;    // normal increment
            }

            await this.storage.put("state", state);

            const year2 = (state.year % 100).toString().padStart(2, "0");
            return Response.json({
                caseNumber: this.formatCaseNumber(year2, state.counter),
                year: year2,
                counter: state.counter
            });
        }

        if (req.method === "POST" && path === "/api/set") {
            // Admin-only initialization / correction: body { year:number, counter:number }
            if (req.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
                return new Response("Unauthorized", { status: 401 });
            }
            const body = await req.json().catch(() => ({}));
            const year = typeof body.year === "number" ? body.year : currentYearFullOslo();
            const counter = typeof body.counter === "number" ? body.counter : 0;

            const newState: State = { year, counter };
            await this.storage.put("state", newState);

            const year2 = (year % 100).toString().padStart(2, "0");
            return Response.json({
                ok: true,
                year: year2,
                counter,
                caseNumber: `${year2}/${counter.toString().padStart(6, "0")}`
            });
        }

        return new Response("Not found", { status: 404 });
    }
}

export default {
    async fetch(req: Request, env: Env) {
        // Single, global Durable Object instance
        const id = env.COUNTER.idFromName("global");
        const stub = env.COUNTER.get(id);
        return stub.fetch(req);
    }
};
