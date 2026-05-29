import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BuyBonusRequest, InitRequest, SimulateRequest, SpinRequest } from "../../../shared/contracts/api.js";
import { SpinEngine } from "../spin-engine/spinEngine.js";
import { runSimulation } from "../simulation/simulator.js";

// Single engine instance for the process lifetime.
const engine = new SpinEngine();
// Captured once at startup to identify the exact build deployed.
const buildTime = new Date().toISOString();

export function startApiServer(port = Number(process.env.PORT ?? 3000)): void {
  createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      // Minimal CORS preflight support for local/static frontend integration.
      if (req.method === "OPTIONS") return send(res, 204, {});
      // Ops endpoints used by deployment and aggregator smoke checks.
      if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/version") return send(res, 200, engine.version(buildTime));
      // Core game flow endpoints.
      if (req.method === "POST" && url.pathname === "/init") return send(res, 200, engine.init((await readJson(req)) as InitRequest));
      if (req.method === "POST" && url.pathname === "/spin") return send(res, 200, engine.spin((await readJson(req)) as SpinRequest));
      if (req.method === "POST" && url.pathname === "/buy-bonus") return send(res, 200, engine.buyBonus((await readJson(req)) as BuyBonusRequest));
      // Simple round listing for audit UI / troubleshooting.
      if (req.method === "GET" && url.pathname === "/rounds") {
        return send(res, 200, { rounds: engine.listRounds(Number(url.searchParams.get("limit") ?? 50)) });
      }
      if (req.method === "GET" && url.pathname.startsWith("/round/")) {
        return send(res, 200, { round: engine.getRound(decodeURIComponent(url.pathname.replace("/round/", ""))) });
      }
      if (req.method === "POST" && url.pathname === "/replay") {
        const body = await readJson(req) as { roundId?: string };
        if (!body.roundId) throw new Error("ROUND_ID_REQUIRED");
        return send(res, 200, engine.replayRound(body.roundId));
      }
      if (req.method === "POST" && url.pathname === "/simulate") {
        return send(res, 200, runSimulation((await readJson(req)) as SimulateRequest));
      }
      return send(res, 404, { error: { code: "NOT_FOUND", message: "Endpoint non disponibile." } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      return send(res, 400, { error: { code: message, message } });
    }
  }).listen(port, () => {
    console.log(`Treasure Reels demo API listening on :${port}`);
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: unknown[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  // Empty body is valid for some endpoints.
  return body ? JSON.parse(body) : {};
}

function send(res: ServerResponse, status: number, body: unknown): void {
  // CORS is intentionally wide in demo mode; lock this down in production.
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) startApiServer();
