import { useEffect, useRef, useState } from 'react';

import { vscode } from '../vscodeApi.js';

interface TerminalPanelProps {
  selectedAgentId: number | null;
  agents: number[];
}

// Store terminal xterm instances per agent
// We use a module-level map since we need it to persist across re-renders
const terminalInstances = new Map<
  number,
  {
    terminal: import('@xterm/xterm').Terminal;
    fitAddon: import('@xterm/addon-fit').FitAddon;
  }
>();

// PTY data buffer for agents whose terminals aren't mounted yet
const ptyDataBuffer = new Map<number, string[]>();

// Global message listener for PTY data
let globalPtyHandler: ((id: number, data: string) => void) | null = null;

window.addEventListener('message', (e: MessageEvent<unknown>) => {
  const msg = e.data as { type: string; id: number; data: string };
  if (msg.type === 'ptyData') {
    if (globalPtyHandler) {
      globalPtyHandler(msg.id, msg.data);
    } else {
      // Buffer until mounted
      const buf = ptyDataBuffer.get(msg.id) ?? [];
      buf.push(msg.data);
      ptyDataBuffer.set(msg.id, buf);
    }
  }
});

export function TerminalPanel({ selectedAgentId, agents }: TerminalPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    globalPtyHandler = (id: number, data: string) => {
      const inst = terminalInstances.get(id);
      if (inst) {
        inst.terminal.write(data);
      } else {
        const buf = ptyDataBuffer.get(id) ?? [];
        buf.push(data);
        ptyDataBuffer.set(id, buf);
      }
    };
    return () => {
      globalPtyHandler = null;
    };
  }, []);

  // Initialize xterm for new agents
  useEffect(() => {
    if (!isOpen) return;

    const initTerminals = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      // Import CSS
      await import('@xterm/xterm/css/xterm.css');

      for (const agentId of agents) {
        if (terminalInstances.has(agentId)) continue;
        const container = containerRefs.current.get(agentId);
        if (!container) continue;

        const terminal = new Terminal({
          theme: {
            background: '#1e1e2e',
            foreground: '#cdd6f4',
          },
          fontFamily: 'monospace',
          fontSize: 13,
          cursorBlink: true,
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        fitAddon.fit();

        terminal.onData((data) => {
          vscode.postMessage({ type: 'ptyInput', id: agentId, data });
        });

        terminalInstances.set(agentId, { terminal, fitAddon });

        // Flush buffered PTY data
        const buf = ptyDataBuffer.get(agentId);
        if (buf) {
          for (const chunk of buf) terminal.write(chunk);
          ptyDataBuffer.delete(agentId);
        }
      }
      forceUpdate((n) => n + 1);
    };

    initTerminals().catch(console.error);
  }, [isOpen, agents]);

  // Clean up terminals for removed agents
  useEffect(() => {
    for (const [agentId, inst] of terminalInstances) {
      if (!agents.includes(agentId)) {
        inst.terminal.dispose();
        terminalInstances.delete(agentId);
      }
    }
  }, [agents]);

  // Fit active terminal on resize
  useEffect(() => {
    if (!isOpen || selectedAgentId === null) return;
    const inst = terminalInstances.get(selectedAgentId);
    if (inst) {
      inst.fitAddon.fit();
    }
  }, [isOpen, selectedAgentId]);

  const panelHeight = 280;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 45,
      }}
    >
      {/* Panel handle */}
      <div
        onClick={() => setIsOpen((v) => !v)}
        style={{
          position: 'absolute',
          bottom: isOpen ? panelHeight : 0,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          borderBottom: isOpen ? 'none' : '2px solid var(--pixel-border)',
          padding: '2px 12px',
          fontSize: '18px',
          color: 'var(--pixel-text-dim)',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {isOpen ? '▼ Terminal' : '▲ Terminal'}
      </div>

      {/* Terminal panel */}
      {isOpen && (
        <div
          style={{
            height: panelHeight,
            background: '#1e1e2e',
            border: '2px solid var(--pixel-border)',
            borderBottom: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--pixel-border)',
              background: 'var(--pixel-bg)',
              flexShrink: 0,
            }}
          >
            {agents.map((agentId) => (
              <div
                key={agentId}
                onClick={() => {
                  vscode.postMessage({ type: 'focusAgent', id: agentId });
                }}
                style={{
                  padding: '2px 12px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  borderRight: '1px solid var(--pixel-border)',
                  background:
                    agentId === selectedAgentId ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color:
                    agentId === selectedAgentId ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                  userSelect: 'none',
                }}
              >
                Agent {agentId}
              </div>
            ))}
          </div>

          {/* Terminal containers */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {agents.map((agentId) => (
              <div
                key={agentId}
                ref={(el) => {
                  if (el) containerRefs.current.set(agentId, el);
                  else containerRefs.current.delete(agentId);
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: '4px',
                  display: agentId === selectedAgentId ? 'block' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
