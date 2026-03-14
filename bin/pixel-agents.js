#!/usr/bin/env node
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ── Pure logic (exported for tests) ──────────────────────────

export function parseCliArgs(argv) {
  const args = argv.slice(2); // strip node + script path

  let command = 'start'; // default
  const flags = [];

  if (args.length > 0 && !args[0].startsWith('-')) {
    command = args[0];
    flags.push(...args.slice(1));
  } else {
    flags.push(...args);
  }

  // --help / -h can appear anywhere
  if (
    command === '--help' ||
    command === '-h' ||
    flags.includes('--help') ||
    flags.includes('-h')
  ) {
    return { command: 'help', flags: [] };
  }

  return { command, flags };
}

export function helpText() {
  return `
Usage: pixel-agents [command] [options]

Commands:
  start            Start the server and open in browser (default)

Options:
  --mock [n]       Boot with n mock agents for demo (default 3, max 8)
  --workspace dir  Set workspace folder (repeatable for multi-root)
  --port n         Port to listen on (default: 3000 or PORT env var)
  -h, --help       Show this help message

Examples:
  npx pixel-agents
  npx pixel-agents start --mock 2
  npx pixel-agents start --workspace /path/to/project
  `.trim();
}

// ── Side-effectful helpers ────────────────────────────────────

function openBrowser(url) {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Non-critical — user can open the URL manually
  }
}

export function findServerEntry() {
  const distPath = path.join(rootDir, 'dist', 'server.js');
  if (fs.existsSync(distPath)) return { type: 'dist', path: distPath };

  const srcPath = path.join(rootDir, 'server', 'src', 'index.ts');
  if (fs.existsSync(srcPath)) return { type: 'src', path: srcPath };

  return null;
}

function run() {
  const { command, flags } = parseCliArgs(process.argv);

  if (command === 'help') {
    console.log(helpText());
    process.exit(0);
  }

  if (command !== 'start') {
    console.error(`pixel-agents: unknown command '${command}'\n`);
    console.error(helpText());
    process.exit(1);
  }

  const entry = findServerEntry();
  if (!entry) {
    console.error('pixel-agents: server not found.');
    console.error('  Run `npm run build` first, or invoke from the pixel-agents source directory.');
    process.exit(1);
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const url = `http://localhost:${port}`;

  let child;
  if (entry.type === 'dist') {
    child = spawn(process.execPath, [entry.path, ...flags], {
      stdio: ['inherit', 'pipe', 'inherit'],
    });
  } else {
    // Source mode: run via tsx (dev workflow)
    child = spawn('npx', ['tsx', entry.path, ...flags], {
      stdio: ['inherit', 'pipe', 'inherit'],
      cwd: rootDir,
    });
  }

  let browserOpened = false;
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    if (!browserOpened && chunk.toString().includes('Listening on')) {
      browserOpened = true;
      openBrowser(url);
    }
  });

  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

// Only execute when run directly (not when imported by tests)
if (path.resolve(process.argv[1] ?? '') === path.resolve(__filename)) {
  run();
}
