"""Stdio transport handler for local MCP servers."""

from typing import Any, List


class StdioClient:
    """Handles communication with stdio-based MCP servers."""

    def __init__(self, command: str, args: List[str]) -> None:
        self.command = command
        self.args = args

    async def connect(self) -> None:
        """Establish stdin/stdout pipes to the subprocess."""
        # TODO: Implement subprocess launch and communication pipes
        pass

    async def list_tools(self) -> List[Any]:
        """Fetch list of tools from the stdio server."""
        return []
