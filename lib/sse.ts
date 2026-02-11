type Client = { id: number, controller: ReadableStreamDefaultController };
const clients = new Map<number, Client>();
let clientIdSeq = 1;

export function registerClient(controller: ReadableStreamDefaultController) {
  const id = clientIdSeq++;
  clients.set(id, { id, controller });
  // initial ping
  controller.enqueue(encoder(`event: ping\ndata: "hello"\n\n`));
  return () => clients.delete(id);
}

const encoder = (s: string) => new TextEncoder().encode(s);

export function broadcast(message: any) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  for (const c of clients.values()) {
    try { c.controller.enqueue(encoder(data)); } catch {}
  }
}
