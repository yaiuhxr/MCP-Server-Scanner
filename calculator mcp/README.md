# Calculator MCP

A real, working MCP server (not just a beacon) exposing calculator tools
over Streamable HTTP, plus an mDNS advertiser so it's discoverable on the
LAN by `mcp_discover.py`.

## Files

- `calculator_server.py` — the MCP server. Tools: `add`, `subtract`,
  `multiply`, `divide`, `power`, `sqrt`, `evaluate` (sandboxed arithmetic
  expression evaluator — character allow-list + no builtins, blocks
  injection attempts like `__import__(...)`).
- `mdns_advertise.py` — advertises the server on `_mcp._tcp.local.` via
  zeroconf. Fixes applied vs. the original draft:
  1. `type` property corrected to `calculator` (was `filesystem`).
  2. Robust LAN IP detection via UDP-connect trick — no more
     `127.0.1.1` on Debian/WSL.
  3. Auto-retries with a suffixed name on `NonUniqueNameException`
     instead of crashing.
  4. Advertises the actual `/mcp` path and `transport` so a discovery
     client knows exactly what to hit.
- `requirements.txt`

## Run it

```bash
pip install -r requirements.txt

# terminal 1 — the actual server
python3 calculator_server.py
# -> Uvicorn running on http://0.0.0.0:8000, MCP endpoint at /mcp

# terminal 2 — advertise it on the LAN
python3 mdns_advertise.py
# -> Advertising 'Calculator MCP' at http://<lan-ip>:8000/mcp (mDNS: _mcp._tcp.local.)
```

## Verified

Tested directly against the JSON-RPC endpoint (init → tools/list →
tools/call):

- `tools/list` returns all 7 tools with schemas.
- `evaluate("(3 + 4) * 2 / 7")` → `2.0`
- `divide(5, 0)` → clean `isError: true` with message, no crash.
- `evaluate("__import__('os').system('echo pwned')")` → rejected by the
  character allow-list before `eval` ever runs.

Quick manual check with the official inspector, if you want a UI instead
of curl:

```bash
npx @modelcontextprotocol/inspector python3 calculator_server.py
```

## Wiring into mcp_discover.py

Your discovery script should already listen for `_mcp._tcp.local.` — once
`mdns_advertise.py` is running, this server should show up with
`properties["type"] == b"calculator"` and `properties["path"] == b"/mcp"`,
so you can build the connection URL directly from the discovered service
info without guessing the path.

## Common Errors & Troubleshooting

### Chrome / Web Browser Error: `Not Acceptable: Client must accept text/event-stream`

If you open the server URL (e.g., `http://localhost:8000/mcp`) directly in a web browser like Google Chrome, you will see a JSON error response:
```json
{
  "jsonrpc": "2.0",
  "id": "server-error",
  "error": {
    "code": -32600,
    "message": "Not Acceptable: Client must accept text/event-stream"
  }
}
```

**Why this happens:**
FastMCP uses Server-Sent Events (SSE) as its transport protocol under `streamable-http`. Web browsers, by default, request HTML or general data, whereas the MCP endpoint requires the client request header to specifically accept `text/event-stream`.

**How to solve / test correctly:**
1. **Use MCP Inspector (Recommended)**:
   ```bash
   npx @modelcontextprotocol/inspector python calculator_server.py
   ```
2. **Using curl**:
   If testing with `curl` or any other HTTP client, you must explicitly pass the `Accept: text/event-stream` header:
   ```bash
   curl -H "Accept: text/event-stream" http://localhost:8000/mcp
   ```

