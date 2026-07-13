"""Tests for the command-line interface execution."""

from click.testing import CliRunner
from mcp_scanner.cli import main


def test_cli_help() -> None:
    """Verify that --help returns successfully and shows usage info."""
    runner = CliRunner()
    result = runner.invoke(main, ["--help"])
    assert result.exit_code == 0
    assert "Scan, audit, and verify Model Context Protocol (MCP) servers" in result.output


def test_cli_scan_invalid_params() -> None:
    """Verify that running scan without any target parameters shows error info."""
    runner = CliRunner()
    result = runner.invoke(main, ["scan"])
    assert "Error:" in result.output
