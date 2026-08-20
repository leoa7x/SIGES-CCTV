/*
 * Small, authenticated LAN-discovery agent.
 *
 * It runs with host networking and NET_RAW so arp-scan can resolve MAC
 * addresses on the physical LAN. The main API stays isolated in the Docker
 * network and requests scans over HTTP instead of receiving raw-network
 * privileges itself.
 */
const http = require("node:http");
const { spawn } = require("node:child_process");

const bindHost = process.env.LAN_DISCOVERY_AGENT_BIND?.trim() || "0.0.0.0";
const port = Number(process.env.LAN_DISCOVERY_AGENT_PORT || "4010");
const token = process.env.LAN_DISCOVERY_AGENT_TOKEN?.trim();
const scanner = process.env.LAN_DISCOVERY_AGENT_COMMAND?.trim()
  || "python3 /app/apps/api/scripts/run_lan_orangutan_scan.py";
let running = false;

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function isValidCidr(value) {
  const match = /^(\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$/.test(value);
  if (!match) return false;
  const [address] = value.split("/");
  return address.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function runScan(target) {
  const [command, ...args] = scanner.split(/\s+/).filter(Boolean);
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args, target], { env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `scanner exited with ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("scanner returned invalid JSON"));
      }
    });
  });
}

if (!token) {
  throw new Error("LAN_DISCOVERY_AGENT_TOKEN is required");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("LAN_DISCOVERY_AGENT_PORT must be a valid TCP port");
}

http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true, running });
  if (request.method !== "POST" || request.url !== "/scan") return send(response, 404, { error: "not found" });
  if (request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: "unauthorized" });

  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", async () => {
    try {
      const target = JSON.parse(body).target;
      if (typeof target !== "string" || !isValidCidr(target)) return send(response, 400, { error: "target must be an IPv4 CIDR" });
      if (running) return send(response, 409, { error: "a scan is already running" });
      running = true;
      const result = await runScan(target);
      send(response, 200, result);
    } catch (error) {
      send(response, 500, { success: false, error: error instanceof Error ? error.message : "scan failed" });
    } finally {
      running = false;
    }
  });
}).listen(port, bindHost, () => {
  console.log(`SIGES LAN discovery agent listening on ${bindHost}:${port}`);
});
