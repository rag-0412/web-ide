"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  webcontainerUrl?: string;
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: any;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
}

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({ 
  webcontainerUrl, 
  className,
  theme = "dark",
  webContainerInstance
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<any>(null);
  const fitAddon = useRef<any | null>(null);
  const searchAddon = useRef<any | null>(null);
  const fitAddonCtor = useRef<any>(null);
  const webLinksCtor = useRef<any>(null);
  const searchCtor = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [XTerm, setXTerm] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Command line state
  const currentLine = useRef<string>("");
  const cursorPosition = useRef<number>(0);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const currentProcess = useRef<any>(null);
  const shellProcess = useRef<any>(null);

  const terminalThemes = {
    dark: {
      background: "#09090B",
      foreground: "#FAFAFA",
      cursor: "#FAFAFA",
      cursorAccent: "#09090B",
      selection: "#27272A",
      black: "#18181B",
      red: "#EF4444",
      green: "#22C55E",
      yellow: "#EAB308",
      blue: "#3B82F6",
      magenta: "#A855F7",
      cyan: "#06B6D4",
      white: "#F4F4F5",
      brightBlack: "#3F3F46",
      brightRed: "#F87171",
      brightGreen: "#4ADE80",
      brightYellow: "#FDE047",
      brightBlue: "#60A5FA",
      brightMagenta: "#C084FC",
      brightCyan: "#22D3EE",
      brightWhite: "#FFFFFF",
    },
    light: {
      background: "#FFFFFF",
      foreground: "#18181B",
      cursor: "#18181B",
      cursorAccent: "#FFFFFF",
      selection: "#E4E4E7",
      black: "#18181B",
      red: "#DC2626",
      green: "#16A34A",
      yellow: "#CA8A04",
      blue: "#2563EB",
      magenta: "#9333EA",
      cyan: "#0891B2",
      white: "#F4F4F5",
      brightBlack: "#71717A",
      brightRed: "#EF4444",
      brightGreen: "#22C55E",
      brightYellow: "#EAB308",
      brightBlue: "#3B82F6",
      brightMagenta: "#A855F7",
      brightCyan: "#06B6D4",
      brightWhite: "#FAFAFA",
    },
  };

  const writePrompt = useCallback(() => {
    if (term.current) {
      term.current.write("\r\n$ ");
      currentLine.current = "";
      cursorPosition.current = 0;
    }
  }, []);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
      }
    },
    clearTerminal: () => {
      clearTerminal();
    },
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
  }));

  const executeCommand = useCallback(async (command: string) => {
    if (!webContainerInstance || !term.current) return;

    // Add to history
    if (command.trim() && commandHistory.current[commandHistory.current.length - 1] !== command) {
      commandHistory.current.push(command);
    }
    historyIndex.current = -1;

    try {
      // Handle built-in commands
      if (command.trim() === "clear") {
        term.current.clear();
        writePrompt();
        return;
      }

      if (command.trim() === "history") {
        commandHistory.current.forEach((cmd, index) => {
          term.current!.writeln(`  ${index + 1}  ${cmd}`);
        });
        writePrompt();
        return;
      }

      if (command.trim() === "") {
        writePrompt();
        return;
      }

      // Parse command
      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Execute in WebContainer
      term.current.writeln("");
      const process = await webContainerInstance.spawn(cmd, args, {
        terminal: {
          cols: term.current.cols,
          rows: term.current.rows,
        },
      });

      currentProcess.current = process;

      // Handle process output
      process.output.pipeTo(new WritableStream({
        write(data) {
          if (term.current) {
            term.current.write(data);
          }
        },
      }));

      // Wait for process to complete
      const exitCode = await process.exit;
      currentProcess.current = null;

      // Show new prompt
      writePrompt();

    } catch (error) {
      if (term.current) {
        term.current.writeln(`\r\nCommand not found: ${command}`);
        writePrompt();
      }
      currentProcess.current = null;
    }
  }, [webContainerInstance, writePrompt]);

  const handleTerminalInput = useCallback((data: string) => {
    if (!term.current) return;

    // Handle special characters
    switch (data) {
      case '\r': // Enter
        executeCommand(currentLine.current);
        break;
        
      case '\u007F': // Backspace
        if (cursorPosition.current > 0) {
          currentLine.current = 
            currentLine.current.slice(0, cursorPosition.current - 1) + 
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current--;
          
          // Update terminal display
          term.current.write('\b \b');
        }
        break;
        
      case '\u0003': // Ctrl+C
        if (currentProcess.current) {
          currentProcess.current.kill();
          currentProcess.current = null;
        }
        term.current.writeln("^C");
        writePrompt();
        break;
        
      case '\u001b[A': // Up arrow
        if (commandHistory.current.length > 0) {
          if (historyIndex.current === -1) {
            historyIndex.current = commandHistory.current.length - 1;
          } else if (historyIndex.current > 0) {
            historyIndex.current--;
          }
          
          // Clear current line and write history command
          const historyCommand = commandHistory.current[historyIndex.current];
          term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
          term.current.write(historyCommand);
          currentLine.current = historyCommand;
          cursorPosition.current = historyCommand.length;
        }
        break;
        
      case '\u001b[B': // Down arrow
        if (historyIndex.current !== -1) {
          if (historyIndex.current < commandHistory.current.length - 1) {
            historyIndex.current++;
            const historyCommand = commandHistory.current[historyIndex.current];
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            term.current.write(historyCommand);
            currentLine.current = historyCommand;
            cursorPosition.current = historyCommand.length;
          } else {
            historyIndex.current = -1;
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            currentLine.current = "";
            cursorPosition.current = 0;
          }
        }
        break;
        
      default:
        // Regular character input
        if (data >= ' ' || data === '\t') {
          currentLine.current = 
            currentLine.current.slice(0, cursorPosition.current) + 
            data + 
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current++;
          term.current.write(data);
        }
        break;
    }
  }, [executeCommand, writePrompt]);

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || term.current) return;
    if (!XTerm) return; // xterm not yet loaded

    const TerminalCtor = XTerm;

    const terminal = new TerminalCtor({
      cursorBlink: true,
      fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: terminalThemes[theme],
      allowTransparency: false,
      convertEol: true,
      scrollback: 1000,
      tabStopWidth: 4,
    });

    // Add addons if constructors were loaded
    const FitCtor = fitAddonCtor.current;
    const WebLinksCtor = webLinksCtor.current;
    const SearchCtor = searchCtor.current;

    const fitAddonInstance = FitCtor ? new FitCtor() : null;
    const webLinksAddon = WebLinksCtor ? new WebLinksCtor() : null;
    const searchAddonInstance = SearchCtor ? new SearchCtor() : null;

    if (fitAddonInstance) terminal.loadAddon(fitAddonInstance);
    if (webLinksAddon) terminal.loadAddon(webLinksAddon);
    if (searchAddonInstance) terminal.loadAddon(searchAddonInstance);

    terminal.open(terminalRef.current);
    
    fitAddon.current = fitAddonInstance;
    searchAddon.current = searchAddonInstance;
    term.current = terminal;

    // Handle terminal input
    terminal.onData(handleTerminalInput);

    // Initial fit (guarded)
    const doFit = () => {
      try {
        // only call fit if fitAddon exists and terminal/render dimensions are available
        if (!termRef.current || !fitRef.current) return;
        const termInstance: any = termRef.current;
        const fitAddonInstance: any = fitRef.current;
        // guard against internal xterm state not ready
        const dimsOk =
          termInstance && termInstance._renderService && termInstance._renderService.dimensions &&
          termInstance._renderService.dimensions.css && termInstance._renderService.dimensions.css.cell &&
          typeof termInstance._renderService.dimensions.css.cell.height === "number";
        if (!dimsOk) return;
        // run on next frame to avoid calling during mount
        requestAnimationFrame(() => {
          try {
            if (fitAddonInstance && typeof fitAddonInstance.fit === "function") {
              fitAddonInstance.fit();
            }
          } catch (err) {
            console.warn("Terminal fit failed (ignored):", err);
          }
        });
      } catch (err) {
        console.warn("safe fit guard error:", err);
      }
    };

    // after terminal creation:
    doFit();

    // attach safe resize handler
    const onResize = () => {
      try { doFit(); } catch (e) { /* noop */ }
    };
    window.addEventListener("resize", onResize);
    // cleanup: remove listener and null out refs
    return () => {
      window.removeEventListener("resize", onResize);
      try { if (fitRef.current && typeof fitRef.current.dispose === "function") { fitRef.current.dispose(); } } catch {}
      try { if (termRef.current && typeof termRef.current.dispose === "function") { termRef.current.dispose(); } } catch {}
      fitRef.current = null;
      termRef.current = null;
    };
  }, [theme, handleTerminalInput, writePrompt, XTerm]);

  const connectToWebContainer = useCallback(async () => {
    if (!webContainerInstance || !term.current) return;

    try {
      setIsConnected(true);
      term.current.writeln("✅ Connected to WebContainer");
      term.current.writeln("Ready to execute commands");
      writePrompt();
    } catch (error) {
      setIsConnected(false);
      term.current.writeln("❌ Failed to connect to WebContainer");
      console.error("WebContainer connection error:", error);
    }
  }, [webContainerInstance, writePrompt]);

  const clearTerminal = useCallback(() => {
    if (term.current) {
      term.current.clear();
      term.current.writeln("🚀 WebContainer Terminal");
      writePrompt();
    }
  }, [writePrompt]);

  const copyTerminalContent = useCallback(async () => {
    if (term.current) {
      const content = term.current.getSelection();
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
        } catch (error) {
          console.error("Failed to copy to clipboard:", error);
        }
      }
    }
  }, []);

  const downloadTerminalLog = useCallback(() => {
    if (term.current) {
      const buffer = term.current.buffer.active;
      let content = "";
      
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + "\n";
        }
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const searchInTerminal = useCallback((term: string) => {
    if (searchAddon.current && term) {
      searchAddon.current.findNext(term);
    }
  }, []);

  useEffect(() => {
    // import xterm and addons only on client to avoid SSR errors
    let mounted = true;
    async function loadXtermAndAddons() {
      if (typeof window === 'undefined') return;
      try {
        const [xtermMod, fitMod, webLinksMod, searchMod] = await Promise.all([
          import('xterm'),
          import('xterm-addon-fit'),
          import('xterm-addon-web-links'),
          import('xterm-addon-search'),
        ]);
        // load css (ignore TS type errors for CSS module)
        // @ts-ignore
        await import('xterm/css/xterm.css');
        if (!mounted) return;
        // When storing a function/class constructor in state, wrap it in an updater
        // to avoid React treating it as an updater function (which would call it).
        setXTerm(() => (xtermMod?.Terminal ?? xtermMod?.default ?? xtermMod));
        fitAddonCtor.current = fitMod?.FitAddon ?? fitMod?.default ?? fitMod;
        webLinksCtor.current = webLinksMod?.WebLinksAddon ?? webLinksMod?.default ?? webLinksMod;
        searchCtor.current = searchMod?.SearchAddon ?? searchMod?.default ?? searchMod;
      } catch (e) {
        console.error('Failed to load xterm modules:', e);
      }
    }
    loadXtermAndAddons();
    return () => { mounted = false; };
  }, []);


  useEffect(() => {
    initializeTerminal();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && typeof fitAddon.current.fit === "function") {
        setTimeout(() => {
          try {
            fitAddon.current.fit();
          } catch (e) {
            console.warn("xterm fit on resize failed:", e);
          }
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (currentProcess.current) {
        currentProcess.current.kill();
      }
      if (shellProcess.current) {
        shellProcess.current.kill();
      }
      if (term.current) {
        try {
          term.current.dispose();
        } catch (e) {
          console.warn("Error disposing xterm instance:", e);
        }
        term.current = null;
      }
      // clear addon refs
      fitAddon.current = null;
      searchAddon.current = null;
    };
  }, [initializeTerminal]);

  useEffect(() => {
    if (webContainerInstance && term.current && !isConnected) {
      connectToWebContainer();
    }
  }, [webContainerInstance, connectToWebContainer, isConnected]);

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium">WebContainer Terminal</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value);
                }}
                className="h-6 w-32 text-xs"
              />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copyTerminalContent}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTerminalLog}
            className="h-6 w-6 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative">
        <div 
          ref={terminalRef} 
          className="absolute inset-0 p-2"
          style={{ 
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;