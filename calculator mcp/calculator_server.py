"""
Calculator MCP Server
----------------------
A real, working MCP server exposing calculator tools over Streamable HTTP.
Run standalone:  python3 calculator_server.py
Then advertise it on the LAN with mdns_advertise.py so your mcp_discover.py
can find it.
"""

import math
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Calculator MCP", host="0.0.0.0", port=8000)


@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers together."""
    return a + b


@mcp.tool()
def subtract(a: float, b: float) -> float:
    """Subtract b from a."""
    return a - b


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b


@mcp.tool()
def divide(a: float, b: float) -> float:
    """Divide a by b. Raises an error if b is zero."""
    if b == 0:
        raise ValueError("Division by zero is not allowed.")
    return a / b


@mcp.tool()
def power(base: float, exponent: float) -> float:
    """Raise base to the given exponent."""
    return math.pow(base, exponent)


@mcp.tool()
def sqrt(value: float) -> float:
    """Return the square root of a non-negative number."""
    if value < 0:
        raise ValueError("Cannot take square root of a negative number.")
    return math.sqrt(value)


@mcp.tool()
def evaluate(expression: str) -> float:
    """
    Safely evaluate a basic arithmetic expression, e.g. "(3 + 4) * 2 / 7".
    Only numbers and + - * / ( ) . are permitted -- no names, no calls.
    """
    allowed_chars = set("0123456789.+-*/() \t")
    if not set(expression) <= allowed_chars:
        raise ValueError("Expression contains disallowed characters.")
    # compile in eval-only mode, no names/builtins available
    code = compile(expression, "<calc>", "eval")
    for name in code.co_names:
        raise ValueError(f"Use of name '{name}' is not allowed.")
    return eval(code, {"__builtins__": {}}, {})


if __name__ == "__main__":
    # streamable-http exposes the server at http://<host>:<port>/mcp
    mcp.run(transport="streamable-http")
