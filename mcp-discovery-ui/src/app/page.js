'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Play, 
  RefreshCw, 
  Search, 
  Database, 
  Terminal, 
  FileText, 
  AlertCircle, 
  CheckSquare, 
  ChevronRight, 
  BookOpen, 
  Code,
  LayoutTemplate
} from 'lucide-react';

export default function Home() {
  // Discovery State
  const [servers, setServers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  // Selected Server State
  const [selectedServer, setSelectedServer] = useState(null);
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' | 'resources' | 'prompts'
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(false);
  
  // Capabilities lists
  const [tools, setTools] = useState([]);
  const [resources, setResources] = useState([]);
  const [prompts, setPrompts] = useState([]);

  // Selected Item State
  const [selectedTool, setSelectedTool] = useState(null);
  const [toolParams, setToolParams] = useState({});
  const [selectedResource, setSelectedResource] = useState(null);
  const [resourceContent, setResourceContent] = useState(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);

  // Selected Prompt State
  const [selectedPrompt, setSelectedPrompt] = useState(null);

  // Console Log State (Traffic monitor)
  const [consoleLog, setConsoleLog] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // New visual state for manual tool output
  const [toolOutput, setToolOutput] = useState(null);

  // Chat with AI Copilot State
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', content: "Hello! I am your AI Copilot powered by Groq Llama 3.3. I have access to all discovered MCP servers on your local network. You can tell me to perform actions, ask questions, or coordinate tasks across servers (e.g. 'calculate 15 * 8 and add that as a todo'). How can I help you today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');

  // Load custom API key on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('gemini_api_key') || '';
      setCustomApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key) => {
    setCustomApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_api_key', key);
    }
  };

  // Initial Scan on Mount
  useEffect(() => {
    scanNetwork();
  }, []);

  // Scan for MCP servers
  const scanNetwork = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (data.error) {
        setScanError(data.error);
      } else {
        setServers(data);
      }
    } catch (err) {
      setScanError('Failed to contact scan API');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Helper to format server URL with IPv6 support
  const getServerUrl = (server) => {
    if (!server) return '';
    const ip = server.addresses?.[0] || server.host;
    const hostString = ip.includes(':') && !ip.startsWith('[') ? `[${ip}]` : ip;
    return `http://${hostString}:${server.port}${server.path}`;
  };

  // Select server and load capabilities
  const handleSelectServer = async (server) => {
    setSelectedServer(server);
    setSelectedTool(null);
    setSelectedResource(null);
    setSelectedPrompt(null);
    setResourceContent(null);
    setToolParams({});
    setConsoleLog(null);
    setToolOutput(null); // Clear tool output
    
    setIsLoadingCapabilities(true);
    setTools([]);
    setResources([]);
    setPrompts([]);

    const serverUrl = getServerUrl(server);

    try {
      // 1. Load Tools
      const toolsRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: serverUrl,
          method: 'tools/list',
          params: {}
        })
      });
      const toolsData = await toolsRes.json();
      if (toolsData.error) {
        setConsoleLog({
          type: 'error',
          direction: 'INCOMING',
          payload: toolsData
        });
      } else if (toolsData.result?.tools) {
        setTools(toolsData.result.tools);
        // Auto select first tool
        if (toolsData.result.tools.length > 0) {
          setSelectedTool(toolsData.result.tools[0]);
          initializeParams(toolsData.result.tools[0]);
        }
      }

      // 2. Load Resources
      const resourcesRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: serverUrl,
          method: 'resources/list',
          params: {}
        })
      });
      const resourcesData = await resourcesRes.json();
      if (resourcesData.result?.resources) {
        setResources(resourcesData.result.resources);
      }

      // 3. Load Prompts
      const promptsRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: serverUrl,
          method: 'prompts/list',
          params: {}
        })
      });
      const promptsData = await promptsRes.json();
      if (promptsData.result?.prompts) {
        setPrompts(promptsData.result.prompts);
      }

    } catch (error) {
      console.error('Failed to load server capabilities:', error);
      setConsoleLog({
        type: 'error',
        direction: 'ERROR',
        payload: { error: error.message }
      });
    } finally {
      setIsLoadingCapabilities(false);
    }
  };

  // Initialize tool input parameters based on JSON Schema
  const initializeParams = (tool) => {
    const params = {};
    if (tool?.inputSchema?.properties) {
      Object.entries(tool.inputSchema.properties).forEach(([name, prop]) => {
        if (prop.type === 'boolean') {
          params[name] = false;
        } else if (prop.type === 'number' || prop.type === 'integer') {
          params[name] = 0;
        } else {
          params[name] = '';
        }
      });
    }
    setToolParams(params);
  };

  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    initializeParams(tool);
    setConsoleLog(null);
    setToolOutput(null); // Clear tool output
  };

  // Execute the selected tool
  const handleExecuteTool = async (e) => {
    e.preventDefault();
    if (!selectedServer || !selectedTool || isExecuting) return;

    setIsExecuting(true);
    setConsoleLog(null);
    setToolOutput(null);

    const serverUrl = getServerUrl(selectedServer);
    
    // Cast variables if numeric
    const castedParams = {};
    Object.entries(toolParams).forEach(([key, val]) => {
      const schemaProp = selectedTool.inputSchema?.properties?.[key];
      if (schemaProp?.type === 'number' || schemaProp?.type === 'integer') {
        castedParams[key] = Number(val);
      } else {
        castedParams[key] = val;
      }
    });

    const requestPayload = {
      url: serverUrl,
      method: 'tools/call',
      params: {
        name: selectedTool.name,
        arguments: castedParams
      }
    };

    setConsoleLog({
      type: 'request',
      direction: 'OUTGOING',
      method: 'tools/call',
      payload: requestPayload.params
    });

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      const data = await res.json();
      
      setConsoleLog({
        type: data.error ? 'error' : 'success',
        direction: 'INCOMING',
        method: 'tools/call',
        payload: data
      });

      if (data.error) {
        setToolOutput({ type: 'error', message: data.error.message || JSON.stringify(data.error, null, 2) });
      } else {
        const textContent = data.result?.content
          ?.map(c => c.text || '')
          .join('\n') 
          || JSON.stringify(data.result || data, null, 2);
        setToolOutput({ type: 'success', message: textContent });
      }
    } catch (err) {
      setConsoleLog({
        type: 'error',
        direction: 'ERROR',
        payload: { error: err.message }
      });
      setToolOutput({ type: 'error', message: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const sanitizeName = (name) => {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  const renderMessageContent = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    let isCodeBlock = false;
    let codeContent = [];

    return lines.map((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (isCodeBlock) {
          isCodeBlock = false;
          const content = codeContent.join('\n');
          codeContent = [];
          return (
            <pre key={idx} style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '0.75rem', borderRadius: '6px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', margin: '0.5rem 0', border: '1px solid rgba(255,255,255,0.05)' }}>
              <code>{content}</code>
            </pre>
          );
        } else {
          isCodeBlock = true;
          return null;
        }
      }

      if (isCodeBlock) {
        codeContent.push(line);
        return null;
      }

      const formattedLine = line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} style={{ color: '#ffffff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontFamily: 'monospace', color: '#f43f5e' }}>{part.slice(1, -1)}</code>;
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // Strip the list bullet characters
        const strippedLine = line.trim().substring(2);
        const formattedStripped = strippedLine.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} style={{ color: '#ffffff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pIdx} style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontFamily: 'monospace', color: '#f43f5e' }}>{part.slice(1, -1)}</code>;
          }
          return part;
        });
        return (
          <ul key={idx} style={{ margin: '0.25rem 0 0.25rem 1.25rem', padding: 0, listStyleType: 'disc' }}>
            <li>{formattedStripped}</li>
          </ul>
        );
      }

      return (
        <div key={idx} style={{ minHeight: '1em', lineHeight: 1.5, margin: '0.25rem 0' }}>
          {formattedLine}
        </div>
      );
    });
  };

  // Chat input handler (sends messages to backend route /api/chat)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);

    const newMessages = [...chatMessages, { role: 'user', content: userText }];
    setChatMessages(newMessages);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (customApiKey && customApiKey !== 'Default Server Key Pool') {
        headers['x-api-key'] = customApiKey;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: newMessages,
          servers
        })
      });
      const data = await res.json();

      if (data.error) {
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          content: `⚠️ Error: ${data.error}` 
        }]);
      } else {
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          content: data.result,
          executedCalls: data.executedCalls 
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        content: `⚠️ Connection failure: ${err.message}` 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Read resource
  const handleReadResource = async (resource) => {
    setSelectedResource(resource);
    setIsLoadingResource(true);
    setResourceContent(null);
    setConsoleLog(null);

    const serverUrl = getServerUrl(selectedServer);
    
    const requestPayload = {
      url: serverUrl,
      method: 'resources/read',
      params: {
        uri: resource.uri
      }
    };

    setConsoleLog({
      type: 'request',
      direction: 'OUTGOING',
      method: 'resources/read',
      payload: requestPayload.params
    });

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      const data = await res.json();

      setConsoleLog({
        type: data.error ? 'error' : 'success',
        direction: 'INCOMING',
        method: 'resources/read',
        payload: data
      });

      if (data.result?.contents?.[0]?.text) {
        setResourceContent(data.result.contents[0].text);
      } else {
        setResourceContent('No content returned.');
      }
    } catch (err) {
      setResourceContent(`Failed to read resource: ${err.message}`);
    } finally {
      setIsLoadingResource(false);
    }
  };

  // Select Prompt
  const handleSelectPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setConsoleLog({
      type: 'prompt',
      direction: 'INFO',
      payload: prompt
    });
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <Cpu className="logo-icon" size={28} />
          <div className="logo-text">
            <h1>MCP Network Scan Dashboard</h1>
            <p>Model Context Protocol LAN Explorer & Controller</p>
          </div>
        </div>
        <div className="scan-controls">
          {scanError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>{scanError}</span>
            </div>
          )}
          <button 
            className="btn-primary" 
            onClick={scanNetwork}
            disabled={isScanning}
          >
            <RefreshCw className={isScanning ? 'loading-ring' : ''} size={16} />
            {isScanning ? 'Scanning LAN...' : 'Scan Local Network'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        
        {/* Sidebar: Servers */}
        <div className="glass-panel">
          <div className="panel-header">
            <span className="panel-title">
              <Activity size={16} />
              Active MCP Servers ({servers.length})
            </span>
          </div>
          <div className="panel-body">
            <div className="server-list">
              {servers.length === 0 ? (
                <div className="empty-state">
                  <Search size={32} />
                  <p>No MCP servers discovered on the network yet.</p>
                  <button className="btn-secondary" onClick={scanNetwork}>Scan Now</button>
                </div>
              ) : (
                servers.map((srv, idx) => (
                  <div 
                    key={idx} 
                    className={`server-card ${selectedServer?.name === srv.name ? 'active' : ''}`}
                    onClick={() => handleSelectServer(srv)}
                  >
                    <div className="server-card-header">
                      <span className="server-name">{srv.name}</span>
                      <span className="server-status" />
                    </div>
                    <span className="server-address">
                      {srv.addresses[0] || srv.host}:{srv.port}
                    </span>
                    <div className="server-badges">
                      <span className="badge badge-type">{srv.type}</span>
                      <span className="badge badge-transport">{srv.transport}</span>
                      <span className="badge badge-port">{srv.port}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Central Workspace: Server capabilities */}
        <div className="glass-panel">
          {selectedServer ? (
            <>
              {/* Workspace Navigation Tabs */}
              <div className="workspace-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tools')}
                >
                  <Code size={16} />
                  Tools ({tools.length})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setActiveTab('resources')}
                >
                  <Database size={16} />
                  Resources ({resources.length})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prompts')}
                >
                  <LayoutTemplate size={16} />
                  Prompts ({prompts.length})
                </button>
              </div>

              {/* Workspace Body */}
              <div className="panel-body">
                {isLoadingCapabilities ? (
                  <div className="empty-state">
                    <RefreshCw className="loading-ring" size={32} />
                    <p>Loading server capabilities and schemas...</p>
                  </div>
                ) : (
                  <>
                    {/* TOOLS TAB */}
                    {activeTab === 'tools' && (
                      <div className="execution-workspace">
                        {/* Tool List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '0.5rem' }}>
                          {tools.length === 0 ? (
                            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No tools exposed by this server.</p>
                          ) : (
                            tools.map((tl, idx) => (
                              <div 
                                key={idx} 
                                className={`tool-card ${selectedTool?.name === tl.name ? 'active' : ''}`}
                                onClick={() => handleToolSelect(tl)}
                              >
                                <div className="tool-name">{tl.name}</div>
                                <div className="tool-desc">{tl.description}</div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Tool Execution Panel */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {selectedTool ? (
                            <>
                              <form onSubmit={handleExecuteTool} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{selectedTool.name}</h3>
                                  <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{selectedTool.description}</p>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                                  {selectedTool.inputSchema?.properties ? (
                                    Object.entries(selectedTool.inputSchema.properties).map(([name, prop]) => {
                                      const isRequired = selectedTool.inputSchema.required?.includes(name);
                                      return (
                                        <div key={name} className="parameter-card">
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span className="parameter-title">
                                              {name} {isRequired && <span style={{ color: '#f87171' }}>*</span>}
                                            </span>
                                            <span className="parameter-type">{prop.type}</span>
                                          </div>
                                          {prop.description && (
                                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                                              {prop.description}
                                            </p>
                                          )}
                                          {prop.type === 'boolean' ? (
                                            <input 
                                              type="checkbox"
                                              checked={!!toolParams[name]}
                                              onChange={(e) => setToolParams({ ...toolParams, [name]: e.target.checked })}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          ) : (
                                            <input 
                                              type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                                              className="form-input"
                                              value={toolParams[name] ?? ''}
                                              onChange={(e) => setToolParams({ ...toolParams, [name]: e.target.value })}
                                              required={isRequired}
                                            />
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No input parameters required.</p>
                                  )}
                                </div>

                                <button 
                                  type="submit" 
                                  className="btn-primary" 
                                  style={{ width: '100%', justifyContent: 'center' }}
                                  disabled={isExecuting}
                                >
                                  <Play size={16} />
                                  {isExecuting ? 'Calling Tool...' : 'Execute Tool'}
                                </button>
                              </form>
                              {toolOutput && (
                                <div 
                                  style={{ 
                                    marginTop: '1rem', 
                                    padding: '1rem', 
                                    borderRadius: '8px', 
                                    border: toolOutput.type === 'error' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(167, 139, 250, 0.2)',
                                    background: toolOutput.type === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(167, 139, 250, 0.05)',
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.5rem' 
                                  }}
                                >
                                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: toolOutput.type === 'error' ? '#f87171' : '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {toolOutput.type === 'error' ? 'Execution Error' : 'Execution Result'}
                                  </span>
                                  <pre 
                                    style={{ 
                                      margin: 0, 
                                      padding: '0.75rem', 
                                      borderRadius: '6px', 
                                      background: 'rgba(0, 0, 0, 0.3)', 
                                      color: '#ffffff', 
                                      fontFamily: 'monospace', 
                                      fontSize: '0.85rem', 
                                      whiteSpace: 'pre-wrap', 
                                      maxHeight: '180px', 
                                      overflowY: 'auto' 
                                    }}
                                  >
                                    {toolOutput.message}
                                  </pre>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="empty-state">
                              <Code size={32} />
                              <p>Select a tool to interact with it.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RESOURCES TAB */}
                    {activeTab === 'resources' && (
                      <div className="execution-workspace">
                        {/* Resource List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '0.5rem' }}>
                          {resources.length === 0 ? (
                            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No resources exposed by this server.</p>
                          ) : (
                            resources.map((rs, idx) => (
                              <div 
                                key={idx} 
                                className={`tool-card ${selectedResource?.uri === rs.uri ? 'active' : ''}`}
                                onClick={() => handleReadResource(rs)}
                              >
                                <div className="tool-name">{rs.name}</div>
                                <div className="server-address" style={{ marginBottom: '0.25rem' }}>{rs.uri}</div>
                                <div className="tool-desc">{rs.description}</div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Resource Content Viewer */}
                        <div>
                          {selectedResource ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                              <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedResource.name}</h3>
                                <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace' }}>{selectedResource.uri}</p>
                              </div>

                              <div style={{ flex: 1, overflowY: 'auto' }}>
                                {isLoadingResource ? (
                                  <div className="empty-state">
                                    <RefreshCw className="loading-ring" size={32} />
                                    <p>Reading resource content...</p>
                                  </div>
                                ) : (
                                  <div className="markdown-view">
                                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                                      {resourceContent}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="empty-state">
                              <Database size={32} />
                              <p>Select a resource to read its content.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PROMPTS TAB */}
                    {activeTab === 'prompts' && (
                      <div className="execution-workspace">
                        {/* Prompt List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '0.5rem' }}>
                          {prompts.length === 0 ? (
                            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No prompts exposed by this server.</p>
                          ) : (
                            prompts.map((pr, idx) => (
                              <div 
                                key={idx} 
                                className={`tool-card ${selectedPrompt?.name === pr.name ? 'active' : ''}`}
                                onClick={() => handleSelectPrompt(pr)}
                              >
                                <div className="tool-name">{pr.name}</div>
                                <div className="tool-desc">{pr.description}</div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Prompt Content Viewer */}
                        <div>
                          {selectedPrompt ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                              <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedPrompt.name}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{selectedPrompt.description}</p>
                              </div>

                              <div className="markdown-view" style={{ flex: 1, overflowY: 'auto' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                  Prompt Details
                                </h4>
                                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#f3f4f6' }}>
                                  This prompt is available for client LLMs to structure their task management flow. Use the MCP Inspector to see full template parameters.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="empty-state">
                              <LayoutTemplate size={32} />
                              <p>Select a prompt to view details.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%' }}>
              <Cpu size={48} className="logo-icon" />
              <h2 style={{ color: '#ffffff' }}>No MCP Server Selected</h2>
              <p>Select a discovered Model Context Protocol server from the sidebar to inspect its tools, read resources, or fetch prompt templates.</p>
            </div>
          )}
        </div>

        {/* Right Panel: AI Copilot Chat */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
          <div className="panel-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffffff' }}>
                <Cpu size={16} style={{ color: '#a78bfa' }} />
                AI Copilot (Groq Llama 3.3)
              </span>
            </div>
            {/* Custom API Key input */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input 
                type="password" 
                placeholder="Custom Groq API Key (Optional)..." 
                className="form-input" 
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: '30px', background: 'rgba(0, 0, 0, 0.4)' }}
                value={customApiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
              />
            </div>
          </div>
          
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0, overflow: 'hidden' }}>
            {/* Chat Messages Log */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 'calc(100vh - 300px)' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div 
                    style={{ 
                      maxWidth: '85%', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem', 
                      lineHeight: 1.4,
                      background: msg.role === 'user' ? '#7c3aed' : 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    {renderMessageContent(msg.content)}
                    
                    {/* If tools were executed by this assistant turn, show them */}
                    {msg.executedCalls && msg.executedCalls.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.75rem', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                          Tools Executed:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {msg.executedCalls.map((c, cIdx) => (
                            <div 
                              key={cIdx} 
                              style={{ 
                                background: 'rgba(0, 0, 0, 0.25)', 
                                border: '1px solid rgba(255, 255, 255, 0.08)', 
                                borderRadius: '6px', 
                                padding: '0.4rem 0.6rem', 
                                fontFamily: 'monospace', 
                                fontSize: '0.75rem' 
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                <span style={{ color: '#c084fc', fontWeight: 600 }}>⚙️ {c.serverName}</span>
                                <span style={{ background: 'rgba(124, 58, 237, 0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#a78bfa', fontSize: '0.7rem' }}>
                                  {c.toolName}
                                </span>
                              </div>
                              {c.args && Object.keys(c.args).length > 0 && (
                                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px', marginTop: '0.35rem', borderLeft: '2px solid #7c3aed' }}>
                                  {Object.entries(c.args).map(([key, val]) => (
                                    <div key={key} style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                      <span style={{ color: '#9ca3af' }}>{key}:</span>
                                      <span style={{ color: '#34d399' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {c.output !== undefined && c.output !== null && (
                                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '0.35rem 0.5rem', borderRadius: '4px', marginTop: '0.25rem', borderLeft: '2px solid #10b981' }}>
                                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Output:</div>
                                  <span style={{ color: '#34d399', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {typeof c.output === 'object'
                                      ? (c.output.content?.[0]?.text || JSON.stringify(c.output))
                                      : String(c.output)
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                  <RefreshCw className="loading-ring" size={16} />
                  <span>AI Copilot is orchestrating tools...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.2)' }}>
              <input 
                type="text" 
                placeholder="Ask AI to run tasks across MCP servers..." 
                className="form-input" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <button type="submit" className="btn-primary" disabled={isChatLoading || !chatInput.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
