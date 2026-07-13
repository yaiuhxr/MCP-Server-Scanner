"""Pytest configurations and fixtures."""

import pytest
from mcp_scanner.core.scanner import McpScanner


@pytest.fixture
def scanner() -> McpScanner:
    """Fixture to obtain an instance of the McpScanner."""
    return McpScanner()
