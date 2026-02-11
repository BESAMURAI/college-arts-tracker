import { registerClient } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const unregister = registerClient(controller);
      const keepAlive = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(`event: keepalive\ndata: {}\n\n`)); } catch {}
      }, 25000);

      return () => {
        clearInterval(keepAlive);
        unregister();
      };
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*" // tighten later if needed
    }
  });
}
