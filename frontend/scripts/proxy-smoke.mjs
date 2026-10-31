import { createServer } from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const backend = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader(
    "Set-Cookie",
    "swappy_refresh=test-only; Path=/api/v1/auth; HttpOnly; SameSite=Lax",
  );
  response.end(
    JSON.stringify({
      path: request.url,
      cookie: request.headers.cookie,
      origin: request.headers.origin,
    }),
  );
});
await new Promise((resolve, reject) => {
  backend.once("error", reject);
  backend.listen(18007, "127.0.0.1", resolve);
});
const frontend = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "-p",
    "3108",
    "--hostname",
    "127.0.0.1",
  ],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "/api/v1",
      API_ORIGIN: "http://127.0.0.1:18007",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
frontend.stdout.on("data", (chunk) => {
  output += chunk;
});
frontend.stderr.on("data", (chunk) => {
  output += chunk;
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (output.includes("Ready")) {
      ready = true;
      break;
    }
    if (frontend.exitCode !== null) throw new Error(output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Proxy server failed to start: ${output}`);
  const response = await fetch("http://127.0.0.1:3108/api/v1/auth/csrf", {
    headers: {
      Cookie: "swappy_refresh=test-only",
      Origin: "http://localhost:3000",
    },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.path, "/api/v1/auth/csrf");
  assert.equal(data.cookie, "swappy_refresh=test-only");
  assert.equal(data.origin, "http://localhost:3000");
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(
    response.headers.get("set-cookie") ?? "",
    /Path=\/api\/v1\/auth/,
  );
  console.log(
    "Next same-origin proxy forwards auth path, Origin and Cookie and preserves HttpOnly Set-Cookie. Fixture backend; no real login performed.",
  );
} finally {
  frontend.kill("SIGTERM");
  await new Promise((resolve) => backend.close(resolve));
}
