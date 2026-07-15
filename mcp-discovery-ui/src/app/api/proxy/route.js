process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function readSseResponse(response, targetId) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const data = trimmed.substring(5).trim();

          if (currentEvent === 'message') {
            try {
              const payload = JSON.parse(data);
              if (payload.id === targetId) {
                return payload;
              }
            } catch (e) {
              console.error('Failed to parse message:', e);
            }
          }
        }
      }
    }
    throw new Error('Stream ended without receiving response');
  } finally {
    try {
      await reader.cancel();
    } catch (_) {}
  }
}

async function getJsonRpcResponse(response, targetId) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().startsWith('application/json')) {
    return await response.json();
  } else {
    return await readSseResponse(response, targetId);
  }
}

export async function POST(request) {
  let sseReader = null;
  let timer = null;
  
  try {
    const body = await request.json();
    const { url, method, params } = body;

    if (!url || !method) {
      return Response.json({ error: 'Missing url or method' }, { status: 400 });
    }

    // 1. Establish a new session by sending a POST 'initialize' request
    const initResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mcp-proxy-init',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mcp-discovery-ui', version: '0.1.0' }
        }
      })
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      return Response.json({
        error: `Failed to initialize session: ${initResponse.statusText}. Details: ${errorText}`
      }, { status: initResponse.status });
    }

    // Extract the mcp-session-id header returned by the server
    const sessionId = initResponse.headers.get('mcp-session-id');
    if (!sessionId) {
      return Response.json({
        error: 'Failed to connect to MCP server: Server did not return a session ID in headers'
      }, { status: 500 });
    }

    // 2. Establish the SSE GET connection using the generated mcp-session-id header
    const sseResponse = await fetch(url, {
      headers: {
        'Accept': 'text/event-stream',
        'mcp-session-id': sessionId
      }
    });

    if (!sseResponse.ok) {
      const errorText = await sseResponse.text();
      return Response.json({
        error: `Failed to establish SSE stream: ${sseResponse.statusText}. Details: ${errorText}`
      }, { status: sseResponse.status });
    }

    // Keep the standalone GET stream open in the background so the server validates POST requests
    sseReader = sseResponse.body.getReader();

    // 3. Send the 'notifications/initialized' notification POST request to the server
    const notifyResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      })
    });

    if (!notifyResponse.ok) {
      const errorText = await notifyResponse.text();
      return Response.json({
        error: `Failed to send initialized notification: ${notifyResponse.statusText}. Details: ${errorText}`
      }, { status: notifyResponse.status });
    }

    // 4. Send the actual requested method (e.g. tools/list) and read the response from the POST response stream
    const responsePromise = new Promise(async (resolve, reject) => {
      // Setup a safety timeout of 10 seconds
      timer = setTimeout(() => {
        reject(new Error('MCP server request timed out (10s limit reached)'));
      }, 10000);

      try {
        const actualResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'mcp-proxy-req',
            method,
            params: params || {},
          }),
        });

        if (!actualResponse.ok) {
          const errorText = await actualResponse.text();
          reject(new Error(`Failed to post request: ${errorText}`));
          return;
        }

        const result = await getJsonRpcResponse(actualResponse, 'mcp-proxy-req');
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    const result = await responsePromise;
    clearTimeout(timer);
    
    // Clean up GET stream reader asynchronously (do not await to prevent connection hang)
    if (sseReader) {
      sseReader.cancel().catch(() => {});
    }

    return Response.json(result);

  } catch (error) {
    if (timer) clearTimeout(timer);
    if (sseReader) {
      try {
        sseReader.cancel().catch(() => {});
      } catch (_) {}
    }
    console.error('Proxy Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
