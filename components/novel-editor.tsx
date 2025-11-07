"use client";

import {
    EditorRoot,
    EditorContent,
    type JSONContent
} from 'novel';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';

interface NovelEditorProps {
  value: string;
  placeholder?: string;
  
  height?: string;
  isDark?: boolean;
  onChange?: (html: string, json: any) => void;
}

export interface NovelEditorRef {
  getContent: () => { html: string; json: any };
  setContent: (content: string | any) => void;
  focus: () => void;
}

const NovelEditor = forwardRef<NovelEditorRef, NovelEditorProps>(({
    value,
    isDark = false,
    placeholder = 'Write something amazing...',
    height = '300px',
    onChange,
}, ref) => {
    // Generate unique ID for this editor instance to prevent plugin ID collisions
    const editorId = React.useId();
    const [content, setContent] = useState<JSONContent | undefined>(undefined);
    const [editorInstance, setEditorInstance] = useState<any>(null);

    // Handle content changes
    const handleEditorChange = (editor: any) => {
      if (editor) {
        const html = editor.getHTML();
        const json = editor.getJSON();
        setContent(json);
        onChange?.(html, json);
      }
    };

    // Convert string value to JSONContent if needed
    useEffect(() => {
      if (value && typeof value === "string" && value.trim()) {
        // For any content (HTML or plain text), let the editor handle it
        // We'll pass it via the content prop to EditorContent
        setContent(undefined);
      } else {
        // For empty or undefined values, start with empty content
        setContent(undefined);
      }
    }, [value]);

    // Determine what content to pass to the editor
    const getInitialContent = (): JSONContent | undefined => {
      if (value && typeof value === "string" && value.trim()) {
        // If it's not HTML, create a simple paragraph structure
        if (!value.includes("<")) {
          return {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: value,
                  },
                ],
              },
            ],
          };
        }
      }
      return undefined;
    };

    // Expose methods to parent component
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (editorInstance) {
            const html = editorInstance.getHTML();
            const json = editorInstance.getJSON();
            return { html, json };
          }
          return { html: "", json: null };
        },
        setContent: (newContent: string | any) => {
          if (editorInstance) {
            if (typeof newContent === "string") {
              editorInstance.commands.setContent(newContent);
            } else {
              editorInstance.commands.setContent(newContent);
            }
          }
        },
        focus: () => {
          if (editorInstance) {
            editorInstance.commands.focus();
          }
        },
      }),
      [editorInstance]
    );

    // Create a function that returns fresh extensions for each editor instance
    // This prevents the "Duplicate use of selection JSON ID gapcursor" error
    // Disable gapcursor and dropcursor to prevent plugin ID collisions in production
    const getExtensions = () => [
        StarterKit.configure({
            bulletList: {
                keepMarks: true,
                keepAttributes: false,
            },
            orderedList: {
                keepMarks: true,
                keepAttributes: false,
            },
            gapcursor: false, // Disable to prevent duplicate ID errors in production
            dropcursor: false, // Disable to prevent duplicate ID errors in production
        }),
        Placeholder.configure({
            placeholder: placeholder,
        }),
        TextStyle,
        Color,
        Highlight.configure({
            multicolor: true,
        }),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: 'text-blue-500 hover:text-blue-700 underline cursor-pointer',
            },
        }),
    ];

    return (
      <div className="w-full">
        {/* Editor Toolbar */}
        <div
          className={`border rounded-t-lg px-3 py-2 flex flex-wrap gap-1 ${
            isDark
              ? "border-gray-600 bg-[#170337]"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <button
            type="button"
            onClick={() => editorInstance?.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("bold")
                      ? "bg-gray-600 font-bold"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("bold")
                      ? "bg-gray-200 font-bold"
                      : ""
                  }`
            }`}
            title="Bold (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editorInstance?.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("italic")
                      ? "bg-gray-600 italic"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("italic")
                      ? "bg-gray-200 italic"
                      : ""
                  }`
            }`}
            title="Italic (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editorInstance?.chain().focus().toggleStrike().run()}
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("strike")
                      ? "bg-gray-600 line-through"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("strike")
                      ? "bg-gray-200 line-through"
                      : ""
                  }`
            }`}
            title="Strikethrough"
          >
            <s>S</s>
          </button>
          <div
            className={`w-px mx-1 ${isDark ? "bg-gray-600" : "bg-gray-300"}`}
          ></div>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("heading", { level: 1 })
                      ? "bg-gray-600 font-bold"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("heading", { level: 1 })
                      ? "bg-gray-200 font-bold"
                      : ""
                  }`
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("heading", { level: 2 })
                      ? "bg-gray-600 font-bold"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("heading", { level: 2 })
                      ? "bg-gray-200 font-bold"
                      : ""
                  }`
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("heading", { level: 3 })
                      ? "bg-gray-600 font-bold"
                      : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("heading", { level: 3 })
                      ? "bg-gray-200 font-bold"
                      : ""
                  }`
            }`}
            title="Heading 3"
          >
            H3
          </button>
          <div
            className={`w-px mx-1 ${isDark ? "bg-gray-600" : "bg-gray-300"}`}
          ></div>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleBulletList().run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("bulletList") ? "bg-gray-600" : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("bulletList") ? "bg-gray-200" : ""
                  }`
            }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleOrderedList().run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("orderedList") ? "bg-gray-600" : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("orderedList") ? "bg-gray-200" : ""
                  }`
            }`}
            title="Numbered List"
          >
            1.
          </button>
          <button
            type="button"
            onClick={() =>
              editorInstance?.chain().focus().toggleBlockquote().run()
            }
            className={`px-2 py-1 text-sm border rounded ${
              isDark
                ? `text-gray-300 border-gray-600 hover:bg-gray-700 ${
                    editorInstance?.isActive("blockquote") ? "bg-gray-600" : ""
                  }`
                : `hover:bg-gray-100 ${
                    editorInstance?.isActive("blockquote") ? "bg-gray-200" : ""
                  }`
            }`}
            title="Quote"
          >
            "
          </button>
        </div>

        {/* Editor Content */}
        <div
          className={`border border-t-0 rounded-b-lg overflow-hidden ${
            isDark ? "border-gray-600 bg-[#180438]" : "border-gray-300 bg-white"
          }`}
          style={{ minHeight: height }}
        >
          <EditorRoot key={editorId}>
            <EditorContent
              initialContent={getInitialContent()}
              extensions={getExtensions()}
              onUpdate={({ editor }) => {
                setEditorInstance(editor);
                handleEditorChange(editor);
              }}
              onCreate={({ editor }) => {
                setEditorInstance(editor);
                // Handle HTML content after editor creation
                if (value && typeof value === "string" && value.includes("<")) {
                  editor.commands.setContent(value);
                }
              }}
              editorProps={{
                attributes: {
                  class: `prose prose-lg prose-headings:font-title font-default focus:outline-none max-w-full ${
                    isDark ? "prose-invert text-white" : "text-gray-900"
                  }`,
                  style: `min-height: ${height}; padding: 20px;`,
                },
              }}
              className="min-h-full"
            />
          </EditorRoot>
        </div>
      </div>
    );
  }
);

NovelEditor.displayName = "NovelEditor";
export default NovelEditor;
