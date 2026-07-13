"""Helper utilities for configuration loading and directory discovery."""

import os
import sys
from pathlib import Path


def get_claude_desktop_config_path() -> Path:
    """Resolve the platform-dependent path to the Claude Desktop config file."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        return Path(appdata) / "Claude" / "claude_desktop_config.json"
    elif sys.platform == "darwin":
        return (
            Path.home()
            / "Library"
            / "Application Support"
            / "Claude"
            / "claude_desktop_config.json"
        )
    else:
        # Default fallback for linux or generic settings
        return Path.home() / ".config" / "Claude" / "claude_desktop_config.json"


def get_cursor_mcp_config_path() -> Path:
    """Resolve the platform-dependent path to the Cursor MCP configuration."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        return (
            Path(appdata)
            / "Cursor"
            / "User"
            / "globalStorage"
            / "storage.json"
        )
    elif sys.platform == "darwin":
        return (
            Path.home()
            / "Library"
            / "Application Support"
            / "Cursor"
            / "User"
            / "globalStorage"
            / "storage.json"
        )
    else:
        return (
            Path.home()
            / ".config"
            / "Cursor"
            / "User"
            / "globalStorage"
            / "storage.json"
        )
