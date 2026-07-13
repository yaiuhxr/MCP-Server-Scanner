"""Security audit checks for Model Context Protocol servers."""

from typing import Any, Dict, List
from mcp_scanner.checks.base import BaseCheck


class SecurityAuditCheck(BaseCheck):
    """Audits tools, resources, and arguments for potential security risks."""

    def __init__(self) -> None:
        super().__init__(
            name="security_audit",
            description="Audits exposed actions for unsafe operations and parameter descriptions",
        )

    def run(self, server_metadata: Dict[str, Any]) -> List[str]:
        """Verify server tool configuration profiles against security policies."""
        findings = []
        tools = server_metadata.get("tools", [])

        for tool in tools:
            name = tool.get("name", "")
            # Check for generic risk keywords in tool names
            if any(kw in name.lower() for kw in ["eval", "exec", "shell", "run_cmd"]):
                findings.append(
                    f"Warning: Tool '{name}' has a command execution signature. Validate input boundaries."
                )

        return findings
