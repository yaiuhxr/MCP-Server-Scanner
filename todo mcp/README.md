# Todo List MCP

A real, working MCP server exposing todo list management tools, resources, and prompts over Streamable HTTP, plus an mDNS advertiser so it is discoverable on the LAN.

## Files

- `todo_server.py` — the MCP server. Exposes:
  - **Tools**: `add_todo`, `list_todos`, `complete_todo`, `delete_todo`, `clear_completed_todos`.
  - **Resources**: `todos://list` (exposes the todo list as formatted Markdown).
  - **Prompts**: `manage-todos` (helper prompt to guide AI in managing tasks).
- `mdns_advertise.py` — advertises the server on `_mcp._tcp.local.` via zeroconf with type `todo`.
- `requirements.txt` — dependencies (`mcp`, `zeroconf`).

## Run it

```bash
pip install -r requirements.txt

# Terminal 1 — Start the MCP server
python todo_server.py
# -> FastMCP running on http://0.0.0.0:8001, MCP endpoint at /mcp

# Terminal 2 — Advertise it on the LAN
python mdns_advertise.py
# -> Advertising 'Todo MCP' at http://<lan-ip>:8001/mcp (mDNS: _mcp._tcp.local.)
```

## Verification

Test directly against the server using the official MCP Inspector to explore tools, resources, and prompts:

```bash
npx @modelcontextprotocol/inspector python todo_server.py
```

### Expected Output
- **Tools**:
  - `add_todo(task: str)` -> Add a new task (e.g. `add_todo("Write test cases")`).
  - `list_todos()` -> Lists tasks (e.g. `[ ] 1: Learn MCP`).
  - `complete_todo(todo_id: int)` -> Marks a task completed.
  - `delete_todo(todo_id: int)` -> Deletes a task.
  - `clear_completed_todos()` -> Clears all completed tasks.
- **Resources**:
  - Reading `todos://list` returns the current list of tasks as Markdown.
- **Prompts**:
  - Using the `manage-todos` prompt provides a structured template for task planning.

## Common Errors & Troubleshooting

### Chrome / Web Browser Error: `Not Acceptable: Client must accept text/event-stream`

If you open the server URL (e.g., `http://localhost:8001/mcp`) directly in a web browser like Google Chrome, you will see a JSON error response:
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
   npx @modelcontextprotocol/inspector python todo_server.py
   ```
2. **Using curl**:
   If testing with `curl` or any other HTTP client, you must explicitly pass the `Accept: text/event-stream` header:
   ```bash
   curl -H "Accept: text/event-stream" http://localhost:8001/mcp
   ```

