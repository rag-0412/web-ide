// lib/ai-service.ts

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

class AIService {
  isAvailable() {
      throw new Error('Method not implemented.');
  }
  private apiKey: string;
  private baseUrl: string = 'https://api.groq.com/openai/v1';
  private model: string = 'llama-3.1-70b-versatile'; // Best for code

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      console.warn('GROQ_API_KEY not set. AI features will not work.');
    }
  }

  /**
   * Generate code completion for Monaco Editor
   */
  async generateCompletion(
    code: string,
    cursorPosition: { line: number; column: number },
    language: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    const prompt = `You are an expert code completion assistant. Given the following code and cursor position, provide ONLY the completion that should come next. Do not include explanations or the existing code.

Language: ${language}
Code:
${code}

Cursor is at line ${cursorPosition.line}, column ${cursorPosition.column}.

Provide ONLY the next line(s) of code that should be inserted. Be concise and context-aware.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-coder-6.7b-instruct', // Better for code completion
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature || 0.3,
          max_tokens: options.maxTokens || 150,
          stop: options.stopSequences || ['\n\n'],
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('AI completion error:', error);
      return '';
    }
  }

  /**
   * Chat with AI assistant (for code help, refactoring, etc.)
   */
  async chat(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert coding assistant. Help users write, debug, and improve their code. Provide clear, concise explanations and working code examples.',
            },
            ...messages,
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Groq API error: ${error.error?.message || response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } catch (error) {
      console.error('AI chat error:', error);
      throw error;
    }
  }

  /**
   * Explain code snippet
   */
  async explainCode(code: string, language: string): Promise<string> {
    return this.chat([
      {
        role: 'user',
        content: `Explain this ${language} code in simple terms:\n\n${code}`,
      },
    ]);
  }

  /**
   * Refactor code
   */
  async refactorCode(code: string, language: string, instructions?: string): Promise<string> {
    const prompt = instructions
      ? `Refactor this ${language} code according to these instructions: ${instructions}\n\n${code}`
      : `Refactor this ${language} code to improve readability, performance, and best practices:\n\n${code}`;

    return this.chat([{ role: 'user', content: prompt }]);
  }

  /**
   * Fix bugs in code
   */
  async fixBugs(code: string, language: string, error?: string): Promise<string> {
    const prompt = error
      ? `Fix the following error in this ${language} code:\n\nError: ${error}\n\nCode:\n${code}`
      : `Find and fix any bugs in this ${language} code:\n\n${code}`;

    return this.chat([{ role: 'user', content: prompt }]);
  }

  /**
   * Generate code from description
   */
  async generateCode(description: string, language: string): Promise<string> {
    return this.chat([
      {
        role: 'user',
        content: `Generate ${language} code for the following:\n\n${description}\n\nProvide only the code without explanations.`,
      },
    ]);
  }

  /**
   * Add comments/documentation
   */
  async addDocumentation(code: string, language: string): Promise<string> {
    return this.chat([
      {
        role: 'user',
        content: `Add comprehensive comments and documentation to this ${language} code:\n\n${code}`,
      },
    ]);
  }
}

// Singleton instance
export const aiService = new AIService();

// Export types
export type { Message, CompletionOptions };