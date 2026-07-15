# MCP Discovery & Inspector UI

A beautiful, premium, dark-mode visual web dashboard built with Next.js to scan your local network for active Model Context Protocol (MCP) servers, view their capabilities (Tools, Resources, and Prompts), and interact with them in real-time.

All backend scanning and network proxying are moved into Next.js server-side API routes, allowing you to run them directly in the browser.

## Features
- 🔍 **mDNS Local Network Discovery**: Automatically scans and lists active MCP servers on your LAN utilizing `bonjour-service` in the background.
- 🛠️ **Interactive Tool Runner**: Automatically parses the JSON Input Schemas of discovered tools and dynamically generates HTML form fields for easy parameters configuration.
- 📂 **Resource Inspector**: Loads and reads raw or markdown resources (such as `todos://list`) directly inside the UI.
- 📋 **Prompt Template Explorer**: Displays exposed prompts and template information.
- 💻 **Live JSON-RPC Traffic Monitor**: Visualizes the actual JSON-RPC requests/responses exchanged between the client and the MCP server.

---

## Setup & Running

Make sure you have Node.js (v18+) installed.

### 1. Install Dependencies
Navigate into the UI directory and install the packages:
```bash
cd mcp-discovery-ui
npm install
```

### 2. Start the UI Development Server
```bash
npm run dev
```
The server will start at **[http://localhost:3000](http://localhost:3000)**.

---

## Testing with Local MCP Servers

To see the dashboard in action:

1. **Start the Todo MCP Server & Advertiser**:
   ```bash
   # Terminal A
   python "todo mcp/todo_server.py"
   
   # Terminal B
   python "todo mcp/mdns_advertise.py"
   ```

2. **Start the Calculator MCP Server & Advertiser**:
   ```bash
   # Terminal C
   python "calculator_server.py"   # or python "calculator mcp/calculator_server.py"
   
   # Terminal D
   python "advertise.py"           # or python "calculator mcp/mdns_advertise.py"
   ```

3. **Open the Dashboard**:
   Open **[http://localhost:3000](http://localhost:3000)** in Google Chrome and click the **Scan Local Network** button at the top right. Both MCP servers should show up in the sidebar! Select them to load and run their tools.
