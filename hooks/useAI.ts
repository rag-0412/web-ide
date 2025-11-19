// hooks/useAI.ts
// React hook for accessing AI features throughout the app

import { useState, useCallback } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
}

export interface UseAIReturn {
  loading: boolean;
  error: string | null;
  getCompletion: (
    code: string,
    cursorPosition: { line: number; column: number },
    language: string
  ) => Promise<string>;
  chat: (messages: Message[], fileContext?: FileContext[]) => Promise<string>;
  explainCode: (code: string, language: string) => Promise<string>;
  refactorCode: (code: string, language: string, instructions?: string) => Promise<string>;
  fixBugs: (code: string, language: string, error?: string) => Promise<string>;
  generateCode: (description: string, language: string) => Promise<string>;
  addDocumentation: (code: string, language: string) => Promise<string>;
  reviewCode: (code: string, language: string) => Promise<string>;
  convertCode: (code: string, fromLanguage: string, toLanguage: string) => Promise<string>;
  optimizeCode: (code: string, language: string) => Promise<string>;
  clearError: () => void;
}

export function useAI(): UseAIReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Get inline code completion
   */
  const getCompletion = useCallback(
    async (
      code: string,
      cursorPosition: { line: number; column: number },
      language: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, cursorPosition, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get completion');
        }

        return data.completion || '';
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to get AI completion';
        setError(errorMsg);
        console.error('❌ Completion error:', err);
        return '';
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Chat with AI Assistant
   */
  const chat = useCallback(
    async (messages: Message[], fileContext?: FileContext[]): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chat',
            messages,
            fileContext,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to chat with AI');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to chat with AI';
        setError(errorMsg);
        console.error('❌ Chat error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Explain code
   */
  const explainCode = useCallback(
    async (code: string, language: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'explain', code, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to explain code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to explain code';
        setError(errorMsg);
        console.error('❌ Explain error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Refactor code
   */
  const refactorCode = useCallback(
    async (code: string, language: string, instructions?: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refactor', code, language, instructions }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to refactor code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to refactor code';
        setError(errorMsg);
        console.error('❌ Refactor error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Fix bugs in code
   */
  const fixBugs = useCallback(
    async (code: string, language: string, errorMsg?: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fix', code, language, error: errorMsg }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fix bugs');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to fix bugs';
        setError(errorMsg);
        console.error('❌ Fix error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Generate code from description
   */
  const generateCode = useCallback(
    async (description: string, language: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', description, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to generate code';
        setError(errorMsg);
        console.error('❌ Generate error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Add documentation to code
   */
  const addDocumentation = useCallback(
    async (code: string, language: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'document', code, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add documentation');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to add documentation';
        setError(errorMsg);
        console.error('❌ Document error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Review code quality
   */
  const reviewCode = useCallback(
    async (code: string, language: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', code, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to review code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to review code';
        setError(errorMsg);
        console.error('❌ Review error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Convert code between languages
   */
  const convertCode = useCallback(
    async (code: string, fromLanguage: string, toLanguage: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'convert', code, fromLanguage, toLanguage }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to convert code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to convert code';
        setError(errorMsg);
        console.error('❌ Convert error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Optimize code performance
   */
  const optimizeCode = useCallback(
    async (code: string, language: string): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'optimize', code, language }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to optimize code');
        }

        return data.response;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to optimize code';
        setError(errorMsg);
        console.error('❌ Optimize error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getCompletion,
    chat,
    explainCode,
    refactorCode,
    fixBugs,
    generateCode,
    addDocumentation,
    reviewCode,
    convertCode,
    optimizeCode,
    clearError,
  };
}