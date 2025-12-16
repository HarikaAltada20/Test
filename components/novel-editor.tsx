"use client";

import { EditorRoot, EditorContent, type JSONContent } from "novel";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import React, {
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { ImageIcon, Trash2 } from "lucide-react";

interface NovelEditorProps {
  value: string;
  placeholder?: string;
  height?: string;
  isDark?: boolean;
  onChange?: (html: string, json: any) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export interface NovelEditorRef {
  getContent: () => { html: string; json: any };
  setContent: (content: string | any) => void;
  focus: () => void;
}

const NovelEditor = forwardRef<NovelEditorRef, NovelEditorProps>(
  (
    {
      value,
      isDark = false,
      placeholder = "Write something amazing...",
      height = "300px",
      onChange,
      onImageUpload,
    },
    ref
  ) => {
    // Generate unique ID for this editor instance to prevent plugin ID collisions
    const editorId = React.useId();
    const [content, setContent] = useState<JSONContent | undefined>(undefined);
    const [editorInstance, setEditorInstance] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const supabase = createClient();

    // Clean HTML content - remove &nbsp; from headings and empty paragraphs
    const cleanHtmlContent = (html: string): string => {
      if (!html) return html;

      // Remove &nbsp; from headings (h1, h2, h3, h4, h5, h6)
      let cleaned = html.replace(
        /<(h[1-6])[^>]*>(.*?)<\/h[1-6]>/gi,
        (match, tag, content) => {
          // Remove &nbsp; entities and trim whitespace
          const cleanedContent = content
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          // Only return the heading if it has actual content
          if (cleanedContent) {
            return `<${tag}>${cleanedContent}</${tag}>`;
          }
          return ""; // Remove empty headings
        }
      );

      // Remove empty paragraphs that only contain &nbsp;
      cleaned = cleaned.replace(/<p[^>]*>\s*(&nbsp;|\s)*\s*<\/p>/gi, "");

      // Clean up multiple consecutive empty paragraphs
      cleaned = cleaned.replace(/(<p[^>]*><\/p>\s*){2,}/gi, "<p></p>");

      return cleaned;
    };

    // Handle content changes
    const handleEditorChange = (editor: any) => {
      if (editor) {
        const html = editor.getHTML();
        const cleanedHtml = cleanHtmlContent(html);
        const json = editor.getJSON();
        setContent(json);
        onChange?.(cleanedHtml, json);
      }
    };

    // Convert plain text to HTML with proper paragraph breaks
    const convertPlainTextToHtml = (text: string): string => {
      if (!text || !text.trim()) return "<p></p>";

      // First, try splitting by double newlines (explicit paragraph breaks)
      let paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());

      // If no double newlines found, try to detect paragraph boundaries intelligently
      if (paragraphs.length <= 1) {
        // Use regex to find paragraph break points
        // Pattern: sentence ending (. ! ?) followed by optional space and capital letter
        // Handle both "sentence. Next" and "sentence.Next" (missing space)
        const breakPattern = /([.!?])\s*([A-Z][a-z])/g;
        const breakPoints: number[] = [];
        let match;

        // Find all sentence endings followed by capital letters
        while ((match = breakPattern.exec(text)) !== null) {
          // Break right after the punctuation mark
          const breakIndex = match.index + 1;
          // Check context: only break if there's substantial content before
          const beforeText = text
            .substring(Math.max(0, breakIndex - 100), breakIndex)
            .trim();
          // Only break if we have enough content (at least 30 chars) and it's not an abbreviation
          if (beforeText.length > 30 && !beforeText.match(/[A-Z]\.$/)) {
            breakPoints.push(breakIndex);
          }
        }

        // Also find numbered list items (1., 2., etc.)
        const numberedPattern = /(\d+)\.\s+([A-Z])/g;
        while ((match = numberedPattern.exec(text)) !== null) {
          breakPoints.push(match.index);
        }

        // Find question headings (short questions ending with ?)
        const questionPattern = /([A-Z][^.!?]{0,60}\?)\s+([A-Z][a-z])/g;
        while ((match = questionPattern.exec(text)) !== null) {
          const breakIndex = match.index + match[1].length;
          breakPoints.push(breakIndex);
        }

        // Sort and deduplicate break points (keep at least 50 chars apart)
        breakPoints.sort((a, b) => a - b);
        const uniqueBreaks = breakPoints.filter(
          (point, idx) => idx === 0 || point - breakPoints[idx - 1] > 50
        );

        // Split text at break points
        if (uniqueBreaks.length > 0) {
          const parts: string[] = [];
          for (let i = 0; i <= uniqueBreaks.length; i++) {
            const start = i === 0 ? 0 : uniqueBreaks[i - 1];
            const end =
              i === uniqueBreaks.length ? text.length : uniqueBreaks[i];
            const part = text.substring(start, end).trim();
            if (part) {
              parts.push(part);
            }
          }
          paragraphs = parts.length > 1 ? parts : [text];
        }
      }

      if (paragraphs.length === 0) return "<p></p>";

      return paragraphs
        .map((p) => {
          // Check if this looks like a heading (short, ends with ?, or is a numbered item)
          const isHeading =
            (p.length < 80 && p.endsWith("?")) ||
            p.match(/^\d+\.\s+[A-Z][^.!?]{0,60}$/);

          if (isHeading) {
            // Replace single newlines with <br> tags
            const withBreaks = p.trim().replace(/\n/g, "<br>");
            return `<h2>${withBreaks}</h2>`;
          }

          // Regular paragraph: replace single newlines with <br> tags
          const withBreaks = p.trim().replace(/\n/g, "<br>");
          return `<p>${withBreaks}</p>`;
        })
        .join("");
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
        // If it's not HTML, convert plain text to HTML with paragraph structure
        if (!value.includes("<")) {
          const htmlContent = convertPlainTextToHtml(value);
          // Return undefined so the editor can parse the HTML
          return undefined;
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
            const cleanedHtml = cleanHtmlContent(html);
            const json = editorInstance.getJSON();
            return { html: cleanedHtml, json };
          }
          return { html: "", json: null };
        },
        setContent: (newContent: string | any) => {
          if (editorInstance) {
            if (typeof newContent === "string") {
              // Clean HTML content before setting it
              const cleanedContent = cleanHtmlContent(newContent);
              editorInstance.commands.setContent(cleanedContent);
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

    // Handle image upload
    const handleImageUpload = async (file: File) => {
      try {
        let imageUrl: string;

        if (onImageUpload) {
          // Use custom upload handler if provided
          imageUrl = await onImageUpload(file);
        } else {
          // Default: upload to Supabase contest-assets bucket
          const fileExt = file.name.split(".").pop() || "jpg";
          const timestamp = Date.now();
          const fileName = `blog_content/${timestamp}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("contest-assets")
            .upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("contest-assets").getPublicUrl(fileName);

          imageUrl = publicUrl;
        }

        // Insert image into editor
        if (editorInstance && imageUrl) {
          // Insert the image using setImage to ensure proper node creation with attributes
          editorInstance
            .chain()
            .focus()
            .setImage({ src: imageUrl, alt: file.name })
            .run();

          // After image insertion, ensure there's a paragraph after it for continued typing
          // Use requestAnimationFrame to ensure the DOM is updated
          requestAnimationFrame(() => {
            if (editorInstance) {
              const { state } = editorInstance;
              let imagePos: number | null = null;

              // Find the image we just inserted
              state.doc.descendants((node: any, pos: number) => {
                if (
                  node.type.name === "image" &&
                  node.attrs.src === imageUrl &&
                  imagePos === null
                ) {
                  imagePos = pos;
                }
              });

              if (imagePos !== null) {
                const imageNode = state.doc.nodeAt(imagePos);
                if (imageNode) {
                  const afterImagePos = imagePos + imageNode.nodeSize;

                  // Check if there's already a paragraph after the image
                  const nodeAfter = state.doc.nodeAt(afterImagePos);
                  if (!nodeAfter || nodeAfter.type.name !== "paragraph") {
                    // Insert a paragraph after the image
                    editorInstance
                      .chain()
                      .setTextSelection(afterImagePos)
                      .insertContent("<p></p>")
                      .focus()
                      .run();
                  } else {
                    // Just move cursor to the existing paragraph
                    editorInstance
                      .chain()
                      .setTextSelection(afterImagePos)
                      .focus()
                      .run();
                  }
                }
              }
            }
          });
        }

        toast.success("Image uploaded successfully");
      } catch (error: any) {
        console.error("Image upload error:", error);
        toast.error(error?.message || "Failed to upload image");
      }
    };

    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error("Please select an image file");
          return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error("Image must be 5MB or smaller");
          return;
        }

        handleImageUpload(file);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

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
          class: "text-blue-500 hover:text-blue-700 underline cursor-pointer",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class:
            "max-w-full h-auto rounded-lg my-4 cursor-pointer hover:opacity-80 transition-opacity border-2 border-transparent hover:border-purple-400 focus:border-purple-500 focus:outline-none",
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
          <div
            className={`w-px mx-1 ${isDark ? "bg-gray-600" : "bg-gray-300"}`}
          ></div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`px-2 py-1 text-sm border rounded flex items-center ${
              isDark
                ? "text-gray-300 border-gray-600 hover:bg-gray-700"
                : "hover:bg-gray-100"
            }`}
            title="Insert Image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (editorInstance?.isActive("image")) {
                // Delete the selected image
                editorInstance.chain().focus().deleteSelection().run();
                toast.success("Image removed");
              } else {
                // Try to find and delete image at cursor position
                const { state } = editorInstance;

                // Check if we're in or near an image node
                let imagePos: number | null = null;
                state.doc.descendants((node: any, pos: number) => {
                  if (node.type.name === "image" && imagePos === null) {
                    imagePos = pos;
                  }
                });

                if (imagePos !== null) {
                  // Select and delete the image
                  editorInstance
                    .chain()
                    .setTextSelection(imagePos)
                    .deleteSelection()
                    .run();
                  toast.success("Image removed");
                } else {
                  toast.error(
                    "Please click on an image to select it, then click delete"
                  );
                }
              }
            }}
            className={`px-2 py-1 text-sm border rounded flex items-center ${
              isDark
                ? `text-gray-300 border-gray-600 ${
                    editorInstance?.isActive("image")
                      ? "hover:bg-red-600/20 hover:border-red-500 hover:text-red-400 bg-red-600/10"
                      : "hover:bg-gray-700"
                  }`
                : `${
                    editorInstance?.isActive("image")
                      ? "hover:bg-red-100 hover:border-red-300 hover:text-red-600 bg-red-50"
                      : "hover:bg-gray-100"
                  }`
            }`}
            title={
              editorInstance?.isActive("image")
                ? "Delete Selected Image"
                : "Click on an image first, then click here to delete"
            }
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
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
                // Handle content after editor creation
                if (value && typeof value === "string" && value.trim()) {
                  if (value.includes("<")) {
                    // It's HTML, clean it first before loading
                    const cleanedValue = cleanHtmlContent(value);
                    editor.commands.setContent(cleanedValue);
                  } else {
                    // It's plain text, convert to HTML with paragraph breaks
                    const htmlContent = convertPlainTextToHtml(value);
                    editor.commands.setContent(htmlContent);
                  }
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
