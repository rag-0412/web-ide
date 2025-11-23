import { useState, useEffect, useCallback } from 'react';
import { TemplateFolder } from '@/features/playground/libs/path-to-json';

interface UseWebContainerProps {
  templateData: TemplateFolder | null;
}

interface UseWebContainerReturn {
  serverUrl: string | null;
  isLoading: boolean;
  error: string | null;
  instance: any | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  destroy: () => void;
}

export const useWebContainer = ({ templateData }: UseWebContainerProps): UseWebContainerReturn => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<any | null>(null);

  useEffect(() => {
    // WebContainer is browser-only. Avoid importing on server to prevent SSR errors.
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let wcRef: any = null;

    async function initializeWebContainer() {
      try {
        const mod = await import('@webcontainer/api');
        const WebContainer = mod?.WebContainer ?? (mod as any)?.default ?? mod;
        if (!WebContainer || typeof WebContainer.boot !== 'function') {
          throw new Error('WebContainer API not available');
        }

        const webcontainerInstance = await WebContainer.boot();
        wcRef = webcontainerInstance;

        if (!mounted) return;

        setInstance(webcontainerInstance);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize WebContainer:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize WebContainer');
          setIsLoading(false);
        }
      }
    }

    initializeWebContainer();

    return () => {
      mounted = false;
      try {
        if (wcRef && typeof wcRef.teardown === 'function') {
          // teardown is synchronous in some impls, call it safely
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          wcRef.teardown();
        } else if (wcRef && typeof wcRef.shutdown === 'function') {
          // alternative name
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          wcRef.shutdown();
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  const writeFileSync = useCallback(async (path: string, content: string): Promise<void> => {
    if (!instance) {
      throw new Error('WebContainer instance is not available');
    }

    try {
      // Ensure the folder structure exists (if mkdir is supported)
      const pathParts = path.split('/');
      const folderPath = pathParts.slice(0, -1).join('/');

      if (folderPath && instance.fs && typeof instance.fs.mkdir === 'function') {
        await instance.fs.mkdir(folderPath, { recursive: true }).catch(() => {});
      }

      // Write the file (some implementations expose writeFile)
      if (instance.fs && typeof instance.fs.writeFile === 'function') {
        await instance.fs.writeFile(path, content);
      } else if (typeof instance.writeFile === 'function') {
        await instance.writeFile(path, content);
      } else {
        throw new Error('WebContainer filesystem API not available');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to write file';
      console.error(`Failed to write file at ${path}:`, err);
      throw new Error(`Failed to write file at ${path}: ${errorMessage}`);
    }
  }, [instance]);

  // Added destroy function
  const destroy = useCallback(() => {
    if (!instance) return;
    try {
      if (typeof instance.teardown === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        instance.teardown();
      } else if (typeof instance.shutdown === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        instance.shutdown();
      }
    } catch (e) {
      // ignore
    }
    setInstance(null);
    setServerUrl(null);
  }, [instance]);

  return { serverUrl, isLoading, error, instance, writeFileSync, destroy };
};