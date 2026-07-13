"""Pydantic model schemas for MCP objects and scan results."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class McpServerConfig(BaseModel):
    """Configuration structure for an MCP server as defined in config files."""

    name: str
    transport: str = Field(description="stdio, sse, or websocket")
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: Dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = None


class ScanResult(BaseModel):
    """Schema representing the outcome of a scanner execution."""

    target: str
    is_valid: bool
    connection_successful: bool
    version: Optional[str] = None
    tools: List[Dict[str, Any]] = Field(default_factory=list)
    prompts: List[Dict[str, Any]] = Field(default_factory=list)
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
