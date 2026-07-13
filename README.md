# MCP Server Scanner

A powerful tool to scan, audit, and verify **Model Context Protocol (MCP)** servers. 

Whether you are running MCP servers locally (via Claude Desktop, Cursor, or Windsurf configs) or exposing them over the network (via SSE or WebSockets), **MCP Server Scanner** helps identify active endpoints, validate schemas, check tool capabilities, and analyze security posture.

---

## 🚀 Features

- 🖥️ **Local Configuration Scanning**: Automatically discovers configured MCP servers inside popular AI-assisted IDEs/clients (Claude Desktop, Cursor, Windsurf, etc.).
- 🌐 **Network Scanning**: Checks network hosts and ranges for active SSE (Server-Sent Events) or WebSocket-based MCP server endpoints.
- 🔍 **Protocol & Schema Validation**: Verifies that discovered servers correctly adhere to the Model Context Protocol specifications.
- 🛡️ **Security Auditing**: Analyzes exposed tools for unsafe actions, insecure arguments, and vulnerability configurations.
- 📊 **Structured Reports**: Exports results in clean CLI output, JSON, or Markdown formats.

---

## 🛠️ Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yaiuhxr/MCP-Server-Scanner.git
cd MCP-Server-Scanner

# Setup virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies in editable mode
pip install -e .
```

### Usage

```bash
# Run a quick scan of local desktop configurations
mcp-scanner scan --local

# Scan a specific SSE URL
mcp-scanner scan --url http://localhost:8000/sse

# View options and help
mcp-scanner --help
```

---

## 📂 Project Structure

```text
MCP-Server-Scanner/
├── mcp_scanner/          # Core package
│   ├── cli.py            # CLI commands & arguments parsing
│   ├── core/             # Scanning engine logic
│   ├── models/           # Pydantic schemas (servers, tools, prompts, resources)
│   ├── protocols/        # Stdio, SSE, WebSocket transport layers
│   ├── checks/           # Security, health, and correctness audits
│   └── utils/            # Shared utilities (logging, config loaders)
├── tests/                # Test suite
└── docs/                 # Detailed architecture & guides
```

---

## 🧪 Running Tests

We use `pytest` for testing. Run the suite with:

```bash
pip install -r requirements-dev.txt # Or run with editable dev install
pytest
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
