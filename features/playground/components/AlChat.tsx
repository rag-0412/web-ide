// components/editor/Editor.tsx (or wherever your editor is)
// ADD these imports at the TOP of your file

import { useEffect, useRef, useState } from 'react'; // ← Add if not already there
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { useAI } from '@/hooks/useAI'; // ← ADD THIS (new import)

// Your existing interface (keep it, just showing for reference)
interface EditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  theme?: string;
  // ... any other props you have
}

// UPDATE your component function
export function CodeEditor({ 
  value, 
  language, 
  onChange,
  theme = 'vs-dark',
  // ... any other props
}: EditorProps) {
  
  // ========== ADD THESE STATE & REFS (Step 1) ==========
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [decorations, setDecorations] = useState<string[]>([]);
  const { getCompletion, loading } = useAI(); // ← Use our AI hook
  const lastTriggerTime = useRef(0);
  // ===================================================

  // ========== ADD THIS MOUNT HANDLER (Step 2) ==========
  function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Ctrl+Space for AI completion
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, async () => {
      await triggerAICompletion();
    });

    // Register double Enter for AI completion
    let lastEnterTime = 0;
    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        const now = Date.now();
        if (now - lastEnterTime < 300) {
          e.preventDefault();
          triggerAICompletion();
        }
        lastEnterTime = now;
      }

      // Accept suggestion with Tab
      if (e.keyCode === monaco.KeyCode.Tab && aiSuggestion) {
        e.preventDefault();
        insertAISuggestion();
      }

      // Dismiss suggestion with Escape
      if (e.keyCode === monaco.KeyCode.Escape && aiSuggestion) {
        e.preventDefault();
        clearAISuggestion();
      }
    });

    // Clear suggestion when typing
    editor.onDidChangeModelContent(() => {
      if (aiSuggestion) {
        clearAISuggestion();
      }
    });
  }
  // ===================================================

  // ========== ADD THESE AI FUNCTIONS (Step 3) ==========
  async function triggerAICompletion() {
    if (!editorRef.current || loading) return;

    // Debounce
    const now = Date.now();
    if (now - lastTriggerTime.current < 1000) return;
    lastTriggerTime.current = now;

    const model = editorRef.current.getModel();
    if (!model) return;

    const position = editorRef.current.getPosition();
    if (!position) return;

    const code = model.getValue();
    
    try {
      const completion = await getCompletion(
        code,
        { line: position.lineNumber, column: position.column },
        language
      );

      if (completion) {
        setAiSuggestion(completion);
        showInlineSuggestion(completion, position);
      }
    } catch (error) {
      console.error('❌ Failed to get AI completion:', error);
    }
  }

  function showInlineSuggestion(text: string, position: { lineNumber: number; column: number }) {
    if (!editorRef.current || !monacoRef.current) return;

    if (decorations.length > 0) {
      editorRef.current.deltaDecorations(decorations, []);
    }

    const newDecorations = editorRef.current.deltaDecorations(
      [],
      [
        {
          range: new monacoRef.current.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            after: {
              content: text,
              inlineClassName: 'ai-suggestion-ghost',
            },
            showIfCollapsed: true,
          },
        },
      ]
    );

    setDecorations(newDecorations);
  }

  function insertAISuggestion() {
    if (!editorRef.current || !monacoRef.current || !aiSuggestion) return;

    const position = editorRef.current.getPosition();
    if (!position) return;

    editorRef.current.executeEdits('ai-suggestion', [
      {
        range: new monacoRef.current.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: aiSuggestion,
      },
    ]);

    const lines = aiSuggestion.split('\n');
    const lastLine = lines[lines.length - 1];
    editorRef.current.setPosition({
      lineNumber: position.lineNumber + lines.length - 1,
      column: lines.length === 1 ? position.column + lastLine.length : lastLine.length + 1,
    });

    clearAISuggestion();
  }

  function clearAISuggestion() {
    if (decorations.length > 0 && editorRef.current) {
      editorRef.current.deltaDecorations(decorations, []);
      setDecorations([]);
    }
    setAiSuggestion('');
  }
  // ===================================================

  // ========== UPDATE YOUR RETURN/JSX (Step 4) ==========
  return (
    <div className="relative h-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount} // ← ADD THIS LINE
        theme={theme}
        options={{
          // Keep your existing options, or use these:
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
        }}
      />

      {/* ADD: AI suggestion styling */}
      <style jsx global>{`
        .ai-suggestion-ghost {
          color: #666;
          font-style: italic;
          opacity: 0.5;
        }

        .monaco-editor .ai-suggestion-ghost::after {
          content: ' [Tab to accept]';
          color: #888;
          font-size: 0.85em;
        }
      `}</style>

      {/* ADD: Loading indicator */}
      {loading && (
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-lg flex items-center gap-2 z-50">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          AI thinking...
        </div>
      )}

      {/* ADD: Keyboard hint */}
      {aiSuggestion && !loading && (
        <div className="absolute bottom-2 right-2 bg-gray-800 text-gray-300 px-3 py-1.5 rounded-md text-xs shadow-lg z-50 border border-gray-700">
          Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Tab</kbd> to accept • 
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Esc</kbd> to dismiss
        </div>
      )}
    </div>
  );
  // ===================================================
}