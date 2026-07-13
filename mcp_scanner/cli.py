"""Command Line Interface for the MCP Server Scanner."""

import click
from rich.console import Console
from rich.table import Table

from mcp_scanner import __version__

console = Console()


@click.group()
@click.version_option(version=__version__)
def main() -> None:
    """Scan, audit, and verify Model Context Protocol (MCP) servers."""
    pass


@main.command()
@click.option(
    "--local",
    is_flag=True,
    help="Scan local machine configuration files (Claude Desktop, Cursor, etc.)",
)
@click.option(
    "--url",
    type=str,
    help="Scan a remote or local network-exposed SSE or WebSocket MCP endpoint",
)
@click.option(
    "--output",
    type=click.Choice(["text", "json", "markdown"]),
    default="text",
    help="Output format",
)
def scan(local: bool, url: str | None, output: str) -> None:
    """Scan and verify MCP servers based on the specified scope."""
    if not local and not url:
        console.print(
            "[bold red]Error:[/bold red] You must specify either --local or --url. Use --help for usage details."
        )
        return

    console.print(f"[bold green]Starting MCP Server Scan...[/bold green] (Format: {output})")

    if local:
        console.print("[yellow]Scanning local desktop configurations...[/yellow]")
        # Placeholder for local discovery logic
        table = Table(title="Discovered Local MCP Servers")
        table.add_column("App/Client", style="cyan")
        table.add_column("Server Name", style="magenta")
        table.add_column("Transport", style="green")
        table.add_column("Status", style="bold green")

        table.add_row("Claude Desktop", "filesystem-server", "stdio", "Valid")
        console.print(table)

    if url:
        console.print(f"[yellow]Scanning endpoint: {url}...[/yellow]")
        # Placeholder for network logic
        console.print(f"[green]Successfully connected to protocol handler at {url}[/green]")


if __name__ == "__main__":
    main()
