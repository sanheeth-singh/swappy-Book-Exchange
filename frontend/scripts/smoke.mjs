import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3107', '--hostname', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
try {
 let ready = false;
 for (let i = 0; i < 60; i++) { if (output.includes('Ready')) { ready = true; break; } if (server.exitCode !== null) throw new Error(output); await new Promise((resolve) => setTimeout(resolve, 100)); }
 if (!ready) throw new Error(`Server not ready: ${output}`);
 for (const [path, status, marker] of [['/', 200, 'Your next read is on'], ['/explore', 200, 'Explore books'], ['/design-system', 200, 'design system'], ['/help', 200, 'Know what happens next'], ['/missing-route', 404, 'This page has moved on']]) {
  const response = await fetch(`http://127.0.0.1:3107${path}`); const html = await response.text();
  if (response.status !== status || !html.includes(marker)) throw new Error(`Smoke check failed for ${path}: ${response.status}`);
  console.log(`${path}: ${response.status}, expected content present`);
 }
} finally { server.kill('SIGTERM'); }
