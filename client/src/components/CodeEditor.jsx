import { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

const CURSOR_COLORS = ['#f59e0b', '#34d399', '#f472b6'];

// Monaco wrapper: controlled-ish editing with debounced sync + remote cursors.
export default function CodeEditor({
  file,
  onLocalChange,
  remoteCursors = [], // [{socketId, name, line}]
  hints = [],
  onCursor,
  onEditorReady,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const lastAppliedRef = useRef(0);
  const fileRef = useRef(file);
  fileRef.current = file;

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => {
      onCursor?.(e.position.lineNumber);
    });
    onEditorReady?.(editor);
  };

  // apply remote content updates (version-guarded to avoid echo loops)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !file) return;
    if (file.version > lastAppliedRef.current) {
      const model = editor.getModel();
      if (model && model.getValue() !== file.content) {
        const pos = editor.getPosition();
        model.setValue(file.content);
        if (pos) editor.setPosition(pos);
      }
      lastAppliedRef.current = file.version;
    }
  }, [file?.version, file?.content]);

  // reset version tracking when switching files
  useEffect(() => {
    lastAppliedRef.current = file?.version || 0;
  }, [file?.id]);

  // decorations: remote cursors + AI hints
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const decorations = [];

    remoteCursors.forEach((c, i) => {
      decorations.push({
        range: new monaco.Range(c.line, 1, c.line, 1),
        options: {
          isWholeLine: true,
          className: `remote-cursor-${i % 3}`,
          glyphMarginClassName: 'remote-glyph',
          glyphMarginHoverMessage: { value: `**(peer)** ${c.name} — line ${c.line}` },
          overviewRuler: { color: CURSOR_COLORS[i % 3], position: monaco.editor.OverviewRulerLane.Right },
        },
      });
    });

    hints.forEach((h) => {
      decorations.push({
        range: new monaco.Range(h.line, 1, h.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'ai-hint-glyph',
          glyphMarginHoverMessage: { value: `🤖 **AI Hint:** ${h.hint}` },
          overviewRuler: { color: '#818cf8', position: monaco.editor.OverviewRulerLane.Right },
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [remoteCursors, hints]);

  return (
    <div className="flex-1 min-h-0 relative">
      <style>{`
        .remote-cursor-0 { background: rgba(245,158,11,0.13); }
        .remote-cursor-1 { background: rgba(52,211,153,0.13); }
        .remote-cursor-2 { background: rgba(244,114,182,0.13); }
        .remote-glyph { border-radius: 3px; margin-left: 4px; background: #6366f1; }
        .remote-glyph::after { content: '●'; color: #818cf8; font-size: 9px; }
        .ai-hint-glyph { margin-left: 4px; }
        .ai-hint-glyph::after { content: '🤖'; font-size: 10px; }
      `}</style>
      <Editor
        height="100%"
        theme="vs-dark"
        language="python"
        value={file?.content || ''}
        onMount={handleMount}
        onChange={(value) => onLocalChange(value || '')}
        loading={<div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading editor…</div>}
        options={{
          fontSize: 14,
          fontFamily: 'Consolas, "JetBrains Mono", monospace',
          minimap: { enabled: false },
          glyphMargin: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          renderWhitespace: 'selection',
          padding: { top: 12 },
        }}
      />
    </div>
  );
}
