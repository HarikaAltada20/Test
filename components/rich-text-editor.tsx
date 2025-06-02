'use client';

import React, { useImperativeHandle, forwardRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface RichTextEditorProps {
    value: string;
    placeholder?: string;
    height?: string;
}

// Define methods that can be called from parent component
export interface RichTextEditorRef {
    getContent: () => string;
    setContent: (content: string) => void;
    focus: () => void;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
    value,
    placeholder = 'Write something amazing...',
    height = '300px',
}, ref) => {

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
                style: `min-height: calc(${height} - 60px); padding: 12px 15px;`,
            },
        },
    });

    // Update editor content when value prop changes
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value, false);
        }
    }, [editor, value]);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        getContent: () => {
            const content = editor?.getHTML() || '';
            console.log('[Tiptap] getContent:', content ? content.substring(0, 50) + "..." : "empty");
            return content;
        },
        setContent: (content: string) => {
            console.log('[Tiptap] setContent:', content ? content.substring(0, 50) + "..." : "empty");
            if (editor) {
                editor.commands.setContent(content || '', false);
            }
        },
        focus: () => {
            console.log('[Tiptap] focus called');
            if (editor) {
                editor.commands.focus();
            }
        }
    }), [editor]);

    if (!editor) {
        return (
            <div
                className="border rounded p-4 bg-gray-50 animate-pulse"
                style={{ height: height }}
            >
                Loading editor...
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden" style={{ height: height }}>
            {/* Toolbar */}
            <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    disabled={!editor.can().chain().focus().toggleStrike().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    <s>S</s>
                </button>
                <div className="border-l mx-1"></div>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    H1
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    H2
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    H3
                </button>
                <div className="border-l mx-1"></div>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    •
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    1.
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('blockquote') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    "
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`px-2 py-1 text-sm rounded ${editor.isActive('codeBlock') ? 'bg-gray-200' : 'hover:bg-gray-100'
                        }`}
                >
                    &lt;/&gt;
                </button>
            </div>

            {/* Editor Content */}
            <div className="bg-white" style={{ height: `calc(${height} - 60px)`, overflow: 'auto' }}>
                <EditorContent
                    editor={editor}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
});

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor; 