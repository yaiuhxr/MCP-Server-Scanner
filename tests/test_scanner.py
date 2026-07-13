"""Tests for the core scanner implementation."""

import pytest
from mcp_scanner.core.scanner import McpScanner


def test_local_scan_mock(scanner: McpScanner) -> None:
    """Ensure scanner configuration discovery runs."""
    results = scanner.scan_local_configs()
    assert isinstance(results, list)
    assert len(results) > 0
    assert results[0]["name"] == "mock-local-server"


@pytest.mark.asyncio
async def test_endpoint_scan_mock(scanner: McpScanner) -> None:
    """Ensure network scanning mock resolves correctly."""
    result = await scanner.scan_endpoint("http://localhost:8000/sse")
    assert result["connected"] is True
    assert result["url"] == "http://localhost:8000/sse"
