const WS_URL = `ws://localhost:${(import.meta.env.VITE_SERVER_PORT as string | undefined) ?? '3000'}/ws`;
let ws: WebSocket | null = null;
const queue: string[] = [];

function connect(): WebSocket {
  const socket = new WebSocket(WS_URL);
  socket.onmessage = (e: MessageEvent<string>) => {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.parse(e.data) as unknown }));
  };
  socket.onopen = () => {
    for (const m of queue.splice(0)) socket.send(m);
  };
  socket.onclose = () => {
    ws = null;
    setTimeout(connect, 1000);
  };
  return socket;
}
ws = connect();

export const vscode = {
  postMessage: (msg: unknown) => {
    const data = JSON.stringify(msg);
    if (ws?.readyState === WebSocket.OPEN) ws.send(data);
    else queue.push(data);
  },
};
