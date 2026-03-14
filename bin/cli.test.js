import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findServerEntry, helpText, parseCliArgs } from './pixel-agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(__dirname, 'pixel-agents.js');

// ── parseCliArgs ──────────────────────────────────────────────

describe('parseCliArgs', () => {
  it('defaults to start with no args', () => {
    const { command } = parseCliArgs(['node', 'pixel-agents.js']);
    assert.equal(command, 'start');
  });

  it('parses explicit start command', () => {
    const { command, flags } = parseCliArgs(['node', 'pixel-agents.js', 'start']);
    assert.equal(command, 'start');
    assert.deepEqual(flags, []);
  });

  it('treats flags-only args as start command', () => {
    const { command, flags } = parseCliArgs(['node', 'pixel-agents.js', '--mock', '2']);
    assert.equal(command, 'start');
    assert.deepEqual(flags, ['--mock', '2']);
  });

  it('captures flags after explicit start', () => {
    const { command, flags } = parseCliArgs([
      'node',
      'pixel-agents.js',
      'start',
      '--mock',
      '3',
      '--workspace',
      '/foo',
    ]);
    assert.equal(command, 'start');
    assert.deepEqual(flags, ['--mock', '3', '--workspace', '/foo']);
  });

  it('returns help for --help', () => {
    const { command } = parseCliArgs(['node', 'pixel-agents.js', '--help']);
    assert.equal(command, 'help');
  });

  it('returns help for -h', () => {
    const { command } = parseCliArgs(['node', 'pixel-agents.js', '-h']);
    assert.equal(command, 'help');
  });

  it('returns help when --help appears after start', () => {
    const { command } = parseCliArgs(['node', 'pixel-agents.js', 'start', '--help']);
    assert.equal(command, 'help');
  });

  it('returns empty flags when help is detected', () => {
    const { flags } = parseCliArgs(['node', 'pixel-agents.js', '--help']);
    assert.deepEqual(flags, []);
  });

  it('treats unknown word as command (caller handles error)', () => {
    const { command } = parseCliArgs(['node', 'pixel-agents.js', 'badcmd']);
    assert.equal(command, 'badcmd');
  });

  it('captures remaining flags for unknown command', () => {
    const { command, flags } = parseCliArgs(['node', 'pixel-agents.js', 'badcmd', '--foo']);
    assert.equal(command, 'badcmd');
    assert.deepEqual(flags, ['--foo']);
  });
});

// ── helpText ──────────────────────────────────────────────────

describe('helpText', () => {
  it('includes Usage header', () => {
    assert.ok(helpText().includes('Usage:'));
  });

  it('includes start command', () => {
    assert.ok(helpText().includes('start'));
  });

  it('includes --mock option', () => {
    assert.ok(helpText().includes('--mock'));
  });

  it('includes --workspace option', () => {
    assert.ok(helpText().includes('--workspace'));
  });

  it('includes --help option', () => {
    assert.ok(helpText().includes('--help'));
  });

  it('includes an npx example', () => {
    assert.ok(helpText().includes('npx pixel-agents'));
  });
});

// ── findServerEntry ───────────────────────────────────────────

describe('findServerEntry', () => {
  it('returns a non-null result when run from the source tree', () => {
    // The test runs from the repo root which has server/src/index.ts
    const entry = findServerEntry();
    assert.notEqual(entry, null);
  });

  it('returns an object with type and path when found', () => {
    const entry = findServerEntry();
    if (entry) {
      assert.ok(entry.type === 'dist' || entry.type === 'src');
      assert.ok(typeof entry.path === 'string' && entry.path.length > 0);
    }
  });
});

// ── CLI process integration ───────────────────────────────────

describe('CLI process', () => {
  it('exits 0 and prints Usage for --help', (_, done) => {
    const child = spawn(process.execPath, [binPath, '--help'], { stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', (code) => {
      assert.equal(code, 0);
      assert.ok(out.includes('Usage:'), `expected "Usage:" in output, got:\n${out}`);
      done();
    });
  });

  it('exits 0 and prints Usage for -h', (_, done) => {
    const child = spawn(process.execPath, [binPath, '-h'], { stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', (code) => {
      assert.equal(code, 0);
      assert.ok(out.includes('Usage:'));
      done();
    });
  });

  it('exits 1 for unknown command', (_, done) => {
    const child = spawn(process.execPath, [binPath, 'unknowncmd'], { stdio: 'pipe' });
    let err = '';
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('exit', (code) => {
      assert.equal(code, 1);
      assert.ok(
        err.includes("unknown command 'unknowncmd'"),
        `expected error message in stderr, got:\n${err}`,
      );
      done();
    });
  });

  it('exits 1 and mentions the unknown command name', (_, done) => {
    const child = spawn(process.execPath, [binPath, 'deploy'], { stdio: 'pipe' });
    let err = '';
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('exit', (code) => {
      assert.equal(code, 1);
      assert.ok(err.includes("'deploy'"));
      done();
    });
  });

  it('help output includes --mock option', (_, done) => {
    const child = spawn(process.execPath, [binPath, '--help'], { stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('exit', () => {
      assert.ok(out.includes('--mock'));
      done();
    });
  });
});
