"""
Todo List MCP Server
-------------------
A real, working MCP server exposing todo management tools, resources,
and prompt templates over Streamable HTTP.

Run standalone:  python todo_server.py
Then advertise it on the LAN with mdns_advertise.py.

Note on Web Browser Testing:
If you try to open the MCP endpoint (e.g. http://localhost:8001/mcp) directly
in a browser like Chrome, you will receive:
  "Not Acceptable: Client must accept text/event-stream"
This is expected since the endpoint uses SSE and requires an Accept header
of "text/event-stream". To test/verify, use the MCP Inspector or curl:
  npx @modelcontextprotocol/inspector python todo_server.py
  curl -H "Accept: text/event-stream" http://localhost:8001/mcp
"""

import threading
from typing import Dict, List
from mcp.server.fastmcp import FastMCP

# Setup FastMCP on port 8001 to prevent conflicts with calculator mcp on 8000
mcp = FastMCP("Todo MCP", host="0.0.0.0", port=8001)

# Thread-safe in-memory database
db_lock = threading.Lock()
todos: List[Dict] = [
    {"id": 1, "task": "Learn Model Context Protocol", "completed": False},
    {"id": 2, "task": "Scan for active MCP servers", "completed": False},
]
next_id = 3


@mcp.tool()
def add_todo(task: str) -> str:
    """Add a new task to the todo list."""
    global next_id
    if not task.strip():
        raise ValueError("Task description cannot be empty.")
    with db_lock:
        todo = {"id": next_id, "task": task.strip(), "completed": False}
        todos.append(todo)
        next_id += 1
    return f"Added todo #{todo['id']}: '{todo['task']}'"


@mcp.tool()
def list_todos() -> str:
    """List all current tasks in the todo list."""
    with db_lock:
        if not todos:
            return "The todo list is empty."
        lines = []
        for todo in todos:
            status = "[x]" if todo["completed"] else "[ ]"
            lines.append(f"{status} {todo['id']}: {todo['task']}")
        return "\n".join(lines)


@mcp.tool()
def complete_todo(todo_id: int) -> str:
    """Mark a specific task as completed using its ID."""
    with db_lock:
        for todo in todos:
            if todo["id"] == todo_id:
                todo["completed"] = True
                return f"Completed todo #{todo_id}: '{todo['task']}'"
    raise ValueError(f"Todo with ID {todo_id} not found.")


@mcp.tool()
def delete_todo(todo_id: int) -> str:
    """Delete a task from the todo list using its ID."""
    global todos
    with db_lock:
        for i, todo in enumerate(todos):
            if todo["id"] == todo_id:
                removed = todos.pop(i)
                return f"Deleted todo #{todo_id}: '{removed['task']}'"
    raise ValueError(f"Todo with ID {todo_id} not found.")


@mcp.tool()
def clear_completed_todos() -> str:
    """Remove all completed tasks from the todo list."""
    global todos
    with db_lock:
        initial_count = len(todos)
        todos = [todo for todo in todos if not todo["completed"]]
        removed_count = initial_count - len(todos)
    return f"Cleared {removed_count} completed tasks."


@mcp.resource("todos://list")
def get_todo_resource() -> str:
    """Get the current todo list formatted as a Markdown document."""
    with db_lock:
        if not todos:
            return "# Todo List\n\nNo tasks found! Add some using the `add_todo` tool."
        
        lines = ["# Todo List", ""]
        for todo in todos:
            status = "- [x]" if todo["completed"] else "- [ ]"
            lines.append(f"{status} **Task #{todo['id']}**: {todo['task']}")
        return "\n".join(lines)


@mcp.prompt("manage-todos")
def manage_todos_prompt() -> str:
    """Get a prompt helper to manage your todo list tasks."""
    return (
        "You are an assistant helping the user manage their tasks. "
        "Please read the current todo list using the 'todos://list' resource, "
        "and suggest the next logical steps or help them prioritize, add, or complete tasks."
    )


if __name__ == "__main__":
    # streamable-http exposes the server at http://<host>:<port>/mcp
    mcp.run(transport="streamable-http")
