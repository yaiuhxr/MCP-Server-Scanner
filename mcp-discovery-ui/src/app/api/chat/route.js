process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let currentKeyIndex = 0;
const API_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5
].filter(Boolean);

if (API_KEYS.length === 0 && process.env.GROQ_API_KEY) {
  API_KEYS.push(process.env.GROQ_API_KEY);
}

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

async function callMcpServerDirect(serverUrl, method, params) {
  let sseReader = null;
  let timer = null;
  
  try {
    // 1. Establish a new session by sending a POST 'initialize' request
    const initResponse = await fetch(serverUrl, {
      method: 'POST',
      cache: 'no-store',
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
      throw new Error(`Failed to initialize session: ${initResponse.statusText}. Details: ${errorText}`);
    }

    const sessionId = initResponse.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('Server did not return a session ID in headers');
    }

    // 2. Establish the SSE GET connection using the generated mcp-session-id header
    const sseResponse = await fetch(serverUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/event-stream',
        'mcp-session-id': sessionId
      }
    });

    if (!sseResponse.ok) {
      const errorText = await sseResponse.text();
      throw new Error(`Failed to establish SSE stream: ${sseResponse.statusText}. Details: ${errorText}`);
    }

    // Keep the standalone GET stream open in the background so the server validates POST requests
    sseReader = sseResponse.body.getReader();

    // 3. Send the 'notifications/initialized' notification POST request to the server
    const notifyResponse = await fetch(serverUrl, {
      method: 'POST',
      cache: 'no-store',
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
      throw new Error(`Failed to send initialized notification: ${notifyResponse.statusText}. Details: ${errorText}`);
    }

    // 4. Send the actual requested method (e.g. tools/list) and read the response from the POST response stream
    const responsePromise = new Promise(async (resolve, reject) => {
      // Setup a safety timeout of 10 seconds
      timer = setTimeout(() => {
        reject(new Error('MCP server request timed out (10s limit reached)'));
      }, 10000);

      try {
        const actualResponse = await fetch(serverUrl, {
          method: 'POST',
          cache: 'no-store',
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

    return result;

  } catch (error) {
    if (timer) clearTimeout(timer);
    if (sseReader) {
      try {
        sseReader.cancel().catch(() => {});
      } catch (_) {}
    }
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, servers } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Missing or invalid messages array' }, { status: 400 });
    }

    let apiKey = request.headers.get('x-api-key') || '';
    if (apiKey === 'Default Server Key Pool') {
      apiKey = '';
    }

    // 1. Fetch tools for all discovered servers in parallel using direct calls
    const activeServers = servers || [];
    const serverToolsPromises = activeServers.map(async (server) => {
      const serverUrl = getServerUrl(server);
      try {
        const data = await callMcpServerDirect(serverUrl, 'tools/list', {});
        if (data.result?.tools) {
          return { server, tools: data.result.tools };
        }
      } catch (err) {
        console.error(`Failed to fetch tools for server ${server.name} directly:`, err);
      }
      return { server, tools: [] };
    });

    const serverToolsResults = await Promise.all(serverToolsPromises);

    // 2. Map MCP tools to OpenAI/Groq function definitions
    const toolMapping = new Map();
    const groqTools = [];

    for (const { server, tools } of serverToolsResults) {
      for (const tool of tools) {
        const cleanServer = sanitizeName(server.name);
        const cleanTool = sanitizeName(tool.name);
        const uniqueFuncName = `mcp__${cleanServer}__${cleanTool}`.substring(0, 63);

        toolMapping.set(uniqueFuncName, { server, tool });

        const parameters = tool.inputSchema || { type: 'object', properties: {} };

        groqTools.push({
          type: 'function',
          function: {
            name: uniqueFuncName,
            description: `[Server: ${server.name}] ${tool.description || 'No description provided.'}`,
            parameters: {
              type: parameters.type || 'object',
              properties: parameters.properties || {},
              required: parameters.required || []
            }
          }
        });
      }
    }

    // 3. Format the chat history for Groq API (OpenAI Chat format)
    const currentMessages = [];
    for (const msg of messages) {
      currentMessages.push({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content
      });
    }

    // 4. Run the Agentic tool execution loop
    let loopCount = 0;
    const maxLoops = 10;
    const executedToolCalls = [];

    while (loopCount < maxLoops) {
      let groqRes;
      let responseText = '';
      let responseData = null;

      try {
        const requestMessages = [
          {
            role: 'system',
            content: `You are an AI Coordinator that orchestrates local/LAN Model Context Protocol (MCP) servers. 
You have access to these servers and their tools. 
When the user asks you to perform a task, use the appropriate tools. 
If a task requires using multiple tools, call them in the correct sequence (e.g. call calculator tool, get the answer, then add that answer as a todo task). 
You must handle multiple tools in one user prompt if needed. 
Report tool errors clearly, but do not stop if you can recover or try alternative tools.`
          },
          ...currentMessages
        ];

        const retryResult = await fetchGroqWithRetry(requestMessages, groqTools, apiKey);
        groqRes = retryResult.res;
        responseText = await groqRes.text();
        responseData = JSON.parse(responseText);
      } catch (err) {
        console.error("Failed Groq orchestration attempt:", err);
        return Response.json({ 
          error: `Groq orchestration loop execution failed: ${err.message}. Response preview: ${responseText.substring(0, 500)}` 
        }, { status: 500 });
      }

      if (responseData.error) {
        return Response.json({ 
          error: `Groq API Error: ${responseData.error.message || JSON.stringify(responseData.error)}` 
        }, { status: 500 });
      }

      const choice = responseData.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        return Response.json({ 
          error: 'Groq model returned an empty or invalid content block.' 
        }, { status: 500 });
      }

      // Add the model's turn to conversation history
      currentMessages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls;

      // If no tool calls, the model has given its final response
      if (!toolCalls || toolCalls.length === 0) {
        return Response.json({ 
          result: assistantMessage.content || '',
          executedCalls: executedToolCalls
        });
      }

      // Execute requested functions
      for (const call of toolCalls) {
        const { name, arguments: argsString } = call.function;
        const mapping = toolMapping.get(name);

        if (!mapping) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify({ error: `Tool ${name} is not registered or unavailable.` })
          });
          continue;
        }

        let args = {};
        try {
          args = JSON.parse(argsString);
        } catch (e) {
          console.error("Failed to parse tool call arguments:", e);
        }

        const { server, tool } = mapping;
        let responseValue = null;

        try {
          const proxyData = await callMcpServerDirect(getServerUrl(server), 'tools/call', {
            name: tool.name,
            arguments: args
          });

          if (proxyData.error) {
            responseValue = { error: proxyData.error };
            currentMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              name,
              content: JSON.stringify(responseValue)
            });
          } else {
            responseValue = proxyData.result || proxyData;
            currentMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              name,
              content: JSON.stringify(responseValue)
            });
          }
        } catch (err) {
          console.error(`Failed to execute tool ${tool.name} on ${server.name} directly:`, err);
          responseValue = { error: `Direct MCP server call failure: ${err.message}` };
          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(responseValue)
          });
        }

        executedToolCalls.push({ 
          serverName: server.name, 
          toolName: tool.name, 
          args,
          output: responseValue
        });
      }

      loopCount++;
    }

    return Response.json({ 
      error: 'Max orchestration loops (10) reached without a final text response.' 
    }, { status: 500 });

  } catch (error) {
    console.error('Agent route error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helpers
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getServerUrl(server) {
  if (!server) return '';
  const ip = server.addresses?.[0] || server.host;
  const hostString = ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip;
  return `http://${hostString}:${server.port}${server.path}`;
}

async function callGroqAPI(apiKey, messages, tools) {
  return await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools: tools.length > 0 ? tools : undefined
    })
  });
}

async function fetchGroqWithRetry(messages, tools, customApiKey) {
  if (customApiKey) {
    const res = await callGroqAPI(customApiKey, messages, tools);
    return { res, keyUsed: customApiKey };
  }

  let attempts = 0;
  while (attempts < API_KEYS.length) {
    const activeKey = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

    try {
      const res = await callGroqAPI(activeKey, messages, tools);
      
      if (res.status === 429) {
        console.warn(`Key at index ${currentKeyIndex} hit 429 rate limit. Retrying with next key...`);
        attempts++;
        continue;
      }

      const cloneRes = res.clone();
      try {
        const json = await cloneRes.json();
        if (json.error && (json.error.type === 'rate_limit' || String(json.error.message).includes('rate limit') || String(json.error.message).includes('429'))) {
          console.warn(`Key at index ${currentKeyIndex} returned rate limit JSON error. Retrying with next key...`);
          attempts++;
          continue;
        }
      } catch (_) {}

      return { res, keyUsed: activeKey };
    } catch (err) {
      console.error(`Fetch attempt with key at index ${currentKeyIndex} failed:`, err);
      attempts++;
    }
  }

  throw new Error("All Groq API keys in the rotation pool have been rate-limited or failed.");
}

export const dynamic = 'force-dynamic';
