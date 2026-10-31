import fs from "node:fs";
const spec = JSON.parse(fs.readFileSync("contracts/openapi.json", "utf8"));
const coverage = JSON.parse(fs.readFileSync("contracts/api-coverage.json", "utf8"));
const operations = Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods).filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method)).map(([method, operation]) => ({ path, method: method.toUpperCase(), operationId: operation.operationId })));
const ids = new Set();
for (const row of coverage) { if (ids.has(row.operationId)) throw new Error(`Duplicate coverage: ${row.operationId}`); ids.add(row.operationId); }
for (const operation of operations) { const row = coverage.find((item) => item.operationId === operation.operationId); if (!row || row.path !== operation.path || row.method !== operation.method || !row.screen || !["planned", "integrated", "operational", "intentionally-unused"].includes(row.status)) throw new Error(`Missing or invalid coverage: ${operation.operationId}`); }
if (coverage.length !== operations.length) throw new Error("Stale coverage entries exist.");
console.log(`${operations.length} operations accounted for: ${coverage.filter((row) => row.status === "integrated").length} integrated; ${coverage.filter((row) => row.status === "planned").length} planned; ${coverage.filter((row) => row.status === "operational").length} operational.`);
