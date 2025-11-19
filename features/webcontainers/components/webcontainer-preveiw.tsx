"use client";

import React, { useEffect, useState, useRef } from "react";
import type { TemplateFolder } from "@/features/playground/libs/path-to-json";
import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import TerminalComponent from "./terminal";
import { WebContainer } from "@webcontainer/api";

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup
}

const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl,
  writeFileSync,
  forceResetup = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loadingState, setLoadingState] = useState({
    transforming: false,
    mounting: false,
    installing: false,
    starting: false,
    ready: false,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  
  // Ref to access terminal methods
  const terminalRef = useRef<any>(null);

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      setLoadingState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false,
      });
    }
  }, [forceResetup]);

  useEffect(() => {
    async function setupContainer() {
      // Don't run setup if it's already complete or in progress
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);
        
        // Check if server is already running by testing if files are already mounted
        try {
          const packageJsonExists = await instance.fs.readFile('package.json', 'utf8');
          if (packageJsonExists) {
            // Files are already mounted, just reconnect to existing server
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal("🔄 Reconnecting to existing WebContainer session...\r\n");
            }
            
            // Check if server is already running
            instance.on("server-ready", (port: number, url: string) => {
              console.log(`Reconnected to server on port ${port} at ${url}`);
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(`🌐 Reconnected to server at ${url}\r\n`);
              }
              setPreviewUrl(url);
              setLoadingState((prev) => ({
                ...prev,
                starting: false,
                ready: true,
              }));
              setIsSetupComplete(true);
              setIsSetupInProgress(false);
            });
            
            setCurrentStep(4);
            setLoadingState((prev) => ({ ...prev, starting: true }));
            return;
          }
        } catch (e) {
          // Files don't exist, proceed with normal setup
        }
        
        // Step 1: Transform data
        setLoadingState((prev) => ({ ...prev, transforming: true }));
        setCurrentStep(1);
        
        // Write to terminal
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("🔄 Transforming template data...\r\n");
        }

        // @ts-ignore
        const files = transformToWebContainerFormat(templateData);

        // Determine package directory inside the transformed files (if package.json is nested)
        function findPackageDir(fsObj: any, basePath = ""): string | null {
          for (const key of Object.keys(fsObj)) {
            const node = fsObj[key];
            const currentPath = basePath ? `${basePath}/${key}` : key;
            if (node && node.file && key === 'package.json') {
              return basePath || ".";
            }
            if (node && node.directory) {
              const found = findPackageDir(node.directory, currentPath);
              if (found) return found;
            }
          }
          return null;
        }

        const detectedPackageDir = findPackageDir(files) || null;

        setLoadingState((prev) => ({
          ...prev,
          transforming: false,
          mounting: true,
        }));
        setCurrentStep(2);

        // Step 2: Mount files
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("📁 Mounting files to WebContainer...\r\n");
        }
        
        await instance.mount(files);
        
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("✅ Files mounted successfully\r\n");
        }

        setLoadingState((prev) => ({
          ...prev,
          mounting: false,
          installing: true,
        }));
        setCurrentStep(3);

        // Step 3: Install dependencies
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("📦 Installing dependencies...\r\n");
        }
        
        let pkgObj: any = null;

        // General helper to run a command and stream+capture logs
                const wc = instance!;
                async function runCmd(cmd: string, args: string[]) {
                  const proc = await wc.spawn(cmd, args);
                  let logs = "";
                  try {
                    proc.output.pipeTo(
                      new WritableStream({
                        write(data) {
                          const text = String(data);
                          logs += text;
                          if (terminalRef.current?.writeToTerminal) {
                            terminalRef.current.writeToTerminal(text);
                          }
                        },
                      })
                    );
                  } catch (e) {
                    // ignore pipe errors
                  }
        
                  const code = await proc.exit;
                  return { code, logs };
                }

        // Diagnostics before install
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("🔎 Running diagnostics before install...\r\n");
        }

        try {
          const nodeInfo = await runCmd("node", ["-v"]);
          const npmInfo = await runCmd("npm", ["-v"]);
          const registryInfo = await runCmd("npm", ["config", "get", "registry"]);

          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(`Node: ${nodeInfo.logs.trim()}\r\n`);
            terminalRef.current.writeToTerminal(`Npm: ${npmInfo.logs.trim()}\r\n`);
            terminalRef.current.writeToTerminal(`Registry: ${registryInfo.logs.trim()}\r\n`);
          }

          // Try to read package.json content (if mounted)
          try {
            const pkgPath = detectedPackageDir && detectedPackageDir !== '.' ? `${detectedPackageDir}/package.json` : 'package.json';
            const pkgContent = await instance.fs.readFile(pkgPath, 'utf8');
            const snippet = String(pkgContent).slice(0, 3000);
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(`package.json (at ${pkgPath}):\n${snippet}\n---\n`);
            }
          try {
              pkgObj = JSON.parse(pkgContent);
            } catch (e) {
              // ignore parse errors
            }
          } catch (e) {
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(`⚠️ package.json not found at expected path. Detected package dir: ${detectedPackageDir}\r\n`);
            }
          }
        } catch (diagErr) {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(`⚠️ Diagnostics failed: ${String(diagErr)}\r\n`);
          }
        }

        // If no package.json was found, abort early with a clear message
        if (!pkgObj && !detectedPackageDir) {
          const msg = 'No package.json found in template. Cannot install or start the project. Please ensure your starter template includes a package.json at the project root or a nested folder.';
          console.warn(msg);
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(`❌ ${msg}\r\n`);
          }
          setSetupError(msg);
          setIsSetupInProgress(false);
          setLoadingState({
            transforming: false,
            mounting: false,
            installing: false,
            starting: false,
            ready: false,
          });
          return;
        }

        // Attempt to install dependencies, capture logs and retry once with legacy-peer-deps
        // Run install in detected package dir if any using npm --prefix or via bash -lc
        const installTarget = detectedPackageDir && detectedPackageDir !== '.' ? detectedPackageDir : '.';

        let installResult = await runCmd("bash", ["-lc", `npm install --prefix ${installTarget}`]);
        if (installResult.code !== 0) {
          // Retry once with legacy-peer-deps in case of peer dependency issues
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal("⚠️ Install failed, retrying with --legacy-peer-deps...\r\n");
          }
          installResult = await runCmd("bash", ["-lc", `npm install --prefix ${installTarget} --legacy-peer-deps`]);
        }

        if (installResult.code !== 0) {
          const snippet = installResult.logs ? installResult.logs.slice(-4000) : "";
          throw new Error(`Failed to install dependencies. Exit code: ${installResult.code}. Logs:\n${snippet}`);
        }

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("✅ Dependencies installed successfully\r\n");
        }

        setLoadingState((prev) => ({
          ...prev,
          installing: false,
          starting: true,
        }));
        setCurrentStep(4);

        // Step 4: Start the server
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("🚀 Starting development server...\r\n");
        }

        const startProcess = await instance.spawn("npm", ["run", scriptToRun], {
          // keep shell semantics so --prefix etc work if used
          // (webcontainer spawn accepts options; keep default if not needed)
        });

        // stream start output to terminal (already done)
        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(String(data));
              }
            },
          })
        );

        // wait for either server-ready event OR process exit
        const waitForStart = Promise.race([
          new Promise<void>((resolve) => {
            // server-ready is emitted when a listening server is detected
            const onReady = (port: number, url: string) => {
              instance.off && instance.off("server-ready", onReady);
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(`🌐 Server ready at ${url}\r\n`);
              }
              setPreviewUrl(url);
              setLoadingState((prev) => ({ ...prev, starting: false, ready: true }));
              setIsSetupComplete(true);
              setIsSetupInProgress(false);
              resolve();
            };
            // attach listener (use 'on' or 'addListener' depending on API)
            if (instance.on) instance.on("server-ready", onReady);
          }),
          new Promise<void>(async (resolve) => {
            // also observe the start process exit — short-lived scripts (node test.js) will exit
            const code = await startProcess.exit;
            if (code === 0) {
              // treat successful exit as "ready" for single-run scripts — show output but no iframe
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal("✅ Process exited successfully.\r\n");
              }
              setLoadingState((prev) => ({ ...prev, starting: false, ready: true }));
              setIsSetupComplete(true);
              setIsSetupInProgress(false);
              // leave previewUrl null for single-run scripts (no iframe)
              resolve();
            } else {
              // will be handled by outer catch below (throw error to trigger catch)
              const snippet = installResult?.logs?.slice(-4000) ?? "";
              throw new Error(`Start script exited with code ${code}. Logs:\n${snippet}`);
            }
          }),
        ]);

        await waitForStart;

        // Handle any errors that occurred during setup
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
        }
        
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
        setLoadingState({
          transforming: false,
          mounting: false,
          installing: false,
          starting: false,
          ready: false,
        });
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress]);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Don't kill processes or cleanup when component unmounts
      // The WebContainer should persist across component re-mounts
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-medium">Initializing WebContainer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Setting up the environment for your project...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="text-sm">{error || setupError}</p>
        </div>
      </div>
    );
  }

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;
    
    return (
      <span className={`text-sm font-medium ${
        isComplete ? 'text-green-600' : 
        isActive ? 'text-blue-600' : 
        'text-gray-500'
      }`}>
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      {!previewUrl ? (
        <div className="h-full flex flex-col">
          <div className="w-full max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm mx-auto">
           

            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2 mb-6"
            />

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                {getStepIcon(1)}
                {getStepText(1, "Transforming template data")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(2)}
                {getStepText(2, "Mounting files")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(3)}
                {getStepText(3, "Installing dependencies")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(4)}
                {getStepText(4, "Starting development server")}
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 p-4">
            <TerminalComponent 
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* Preview */}
          <div className="flex-1">
            <iframe
              src={previewUrl}
              className="w-full h-full border-none"
              title="WebContainer Preview"
            />
          </div>
          
          {/* Terminal at bottom when preview is ready */}
          <div className="h-64 border-t">
            <TerminalComponent 
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;