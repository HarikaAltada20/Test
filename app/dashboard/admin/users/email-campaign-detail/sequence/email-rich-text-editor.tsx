"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sanitizeEmailContent } from "@/lib/email/admin-bulk-email";
import {
  BULK_EMAIL_MERGE_VARIABLES,
  mergeTag,
} from "@/lib/admin-notifications/template";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Code,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Send,
  Type,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InsertImageModal } from "./insert-image-modal";
import { InsertLinkModal } from "./insert-link-modal";

const FONTS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
];

const SIZES = ["12", "14", "16", "18", "20", "24"];

const MERGE_TAGS = BULK_EMAIL_MERGE_VARIABLES.map((v) => ({
  label: v.label,
  value: mergeTag(v.key),
}));

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type EditorMode = "visual" | "source" | "preview";

type Props = {
  value: string;
  onChange: (html: string) => void;
  onSave?: () => void;
  onSend?: () => void;
  saving?: boolean;
  sending?: boolean;
  sendDisabled?: boolean;
  minHeight?: number;
  readOnly?: boolean;
  layout?: "campaign" | "reply";
  placeholder?: string;
};

export function EmailRichTextEditor({
  value,
  onChange,
  onSave,
  onSend,
  saving = false,
  sending = false,
  sendDisabled = false,
  minHeight = 280,
  readOnly = false,
  layout = "campaign",
  placeholder = "Write your email content...",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastLocalHtmlRef = useRef<string | null>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const isFocusedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [fontFamily, setFontFamily] = useState(FONTS[0].value);
  const [fontSize, setFontSize] = useState(layout === "reply" ? "16" : "14");
  const [sourceHtml, setSourceHtml] = useState(value);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkDefaultText, setLinkDefaultText] = useState("");
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const syncFromEditor = useCallback(
    (sanitize = false) => {
      const editor = editorRef.current;
      if (!editor?.isConnected) return;
      const raw = editor.innerHTML;
      const html = sanitize ? sanitizeEmailContent(raw) : raw;
      lastLocalHtmlRef.current = html;
      lastEmittedRef.current = html;
      onChange(html);
    },
    [onChange],
  );

  useEffect(() => {
    if (mode === "visual" && editorRef.current) {
      if (isFocusedRef.current && value === lastEmittedRef.current) {
        return;
      }
      const editorHtml = editorRef.current.innerHTML;
      if (
        value === lastLocalHtmlRef.current &&
        editorHtml === value
      ) {
        lastLocalHtmlRef.current = null;
        return;
      }
      if (editorHtml !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
      lastLocalHtmlRef.current = null;
      lastEmittedRef.current = value || "";
    }
    if (mode === "source") {
      setSourceHtml(value);
    }
  }, [value, mode]);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    editor.focus();
    const range = savedRangeRef.current;
    if (!range) return false;
    try {
      if (!editor.contains(range.commonAncestorContainer)) return false;
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const getInsertionRange = (): Range | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    const saved = savedRangeRef.current;
    if (saved) {
      try {
        if (editor.contains(saved.commonAncestorContainer)) {
          return saved.cloneRange();
        }
      } catch {
        // Range was detached from the document.
      }
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const current = sel.getRangeAt(0);
      if (editor.contains(current.commonAncestorContainer)) {
        return current.cloneRange();
      }
    }

    const range = document.createRange();
    if (editor.childNodes.length === 0) {
      range.setStart(editor, 0);
      range.collapse(true);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    return range;
  };

  const exec = (command: string, val?: string) => {
    restoreSelection();
    document.execCommand(command, false, val);
    syncFromEditor();
    saveSelection();
  };

  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncFromEditor();
    saveSelection();
  };

  const insertList = (ordered: boolean) => {
    restoreSelection();
    const sel = window.getSelection();
    const tag = ordered ? "ol" : "ul";
    const cmd = ordered ? "insertOrderedList" : "insertUnorderedList";
    const selectedText = sel?.toString() ?? "";

    if (selectedText) {
      const lines = selectedText.split(/\r?\n/).filter((line) => line.length > 0);
      const items = (lines.length > 0 ? lines : [selectedText])
        .map((line) => `<li>${line}</li>`)
        .join("");
      document.execCommand("insertHTML", false, `<${tag}>${items}</${tag}>`);
    } else {
      document.execCommand(cmd, false);
      const anchor = sel?.anchorNode;
      let inList = false;
      let node: Node | null = anchor ?? null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "UL" || node.nodeName === "OL") {
          inList = true;
          break;
        }
        node = node.parentNode;
      }
      if (!inList) {
        document.execCommand(
          "insertHTML",
          false,
          `<${tag}><li>List item</li></${tag}>`,
        );
      }
    }

    syncFromEditor();
    saveSelection();
  };

  const applyStyleToRange = (
    styleProperty: "fontFamily" | "fontSize",
    styleValue: string,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const range = getInsertionRange();
    if (!range) return;

    const selectedText = range.toString();

    if (selectedText.length > 0) {
      const span = document.createElement("span");
      if (styleProperty === "fontFamily") {
        span.style.fontFamily = styleValue;
      } else {
        span.style.fontSize = styleValue;
      }

      try {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);

        const after = document.createRange();
        after.selectNodeContents(span);
        after.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(after);
        savedRangeRef.current = after.cloneRange();
      } catch {
        restoreSelection();
        document.execCommand("styleWithCSS", false, "true");
        if (styleProperty === "fontFamily") {
          const fontName = styleValue.split(",")[0].replace(/['"]/g, "").trim();
          document.execCommand("fontName", false, fontName);
        } else {
          document.execCommand("fontSize", false, styleValue.replace(/px$/, ""));
        }
      }
    } else {
      restoreSelection();
      document.execCommand("styleWithCSS", false, "true");
      if (styleProperty === "fontFamily") {
        const fontName = styleValue.split(",")[0].replace(/['"]/g, "").trim();
        document.execCommand("fontName", false, fontName);
      } else {
        const span = document.createElement("span");
        span.style.fontSize = styleValue;
        const zwsp = document.createTextNode("\u200B");
        span.appendChild(zwsp);
        range.insertNode(span);
        const caret = document.createRange();
        caret.setStart(zwsp, 1);
        caret.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(caret);
        savedRangeRef.current = caret.cloneRange();
      }
    }

    syncFromEditor();
    saveSelection();
  };

  const applyFont = (font: string) => {
    setFontFamily(font);
    requestAnimationFrame(() => {
      applyStyleToRange("fontFamily", font);
    });
  };

  const applySize = (size: string) => {
    setFontSize(size);
    requestAnimationFrame(() => {
      applyStyleToRange("fontSize", `${size}px`);
    });
  };

  const handleToolbarControlOpen = (open: boolean) => {
    if (!open) return;
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    if (range.toString().length > 0 || !range.collapsed) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const openInsertLinkModal = () => {
    saveSelection();
    const fromSelection = window.getSelection()?.toString() ?? "";
    const fromSaved = savedRangeRef.current?.toString() ?? "";
    setLinkDefaultText(fromSelection || fromSaved);
    setLinkModalOpen(true);
  };

  const confirmInsertLink = (url: string, text?: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const href = normalizeUrl(url);
    const linkText = text?.trim() || href;
    const safeHref = href
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    const safeText = linkText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    editor.focus();
    restoreSelection();
    insertHtml(
      `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`,
    );
  };

  const insertImage = (src: string, alt = "Image") => {
    const safeSrc = src.replace(/"/g, "&quot;");
    const safeAlt = alt
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    insertHtml(
      `<img src="${safeSrc}" alt="${safeAlt}" style="max-width:100%;height:auto;" />`,
    );
  };

  const openInsertImageModal = () => {
    saveSelection();
    setImageModalOpen(true);
  };

  const confirmInsertImage = (url: string, alt?: string) => {
    insertImage(url, alt || "Image");
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file, or use Paperclip for other files.");
      e.target.value = "";
      return;
    }
    if (file.size > 500_000) {
      window.alert(
        "Image is large for email. Host it online and use Image URL instead.",
      );
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        insertImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = window.prompt(
      `For emails, attachments need a public URL.\nEnter URL for "${file.name}":`,
      "https://",
    );
    if (url?.trim()) {
      insertHtml(
        `<p><a href="${url.trim()}" target="_blank" rel="noopener">📎 ${file.name}</a></p>`,
      );
    }
    e.target.value = "";
  };

  const switchMode = (next: EditorMode) => {
    if (mode === "visual" && editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastLocalHtmlRef.current = html;
      onChange(html);
    }
    if (mode === "source") {
      lastLocalHtmlRef.current = sourceHtml;
      onChange(sourceHtml);
    }
    if (mode === "preview" && next === "visual") {
      lastLocalHtmlRef.current = null;
    }
    setMode(next);
    if (next === "source") {
      setSourceHtml(
        mode === "visual" && editorRef.current
          ? editorRef.current.innerHTML
          : value,
      );
    }
  };

  const previewHtml =
    value.includes("<") ? value : `<p>${value.replace(/\n/g, "<br/>")}</p>`;

  const toolbarDisabled = readOnly || mode === "preview";
  const isReply = layout === "reply";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        isReply
          ? "rounded-lg border border-gray-200"
          : "rounded-lg border border-gray-300 min-h-[320px] flex-1",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleAttachment}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      {mode === "preview" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
            Preview
          </div>
          <div
            className="flex-1 overflow-y-auto p-4 text-sm text-gray-800 prose prose-sm max-w-none [&_a]:text-[#662EBD] [&_a]:underline"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (anchor instanceof HTMLAnchorElement && anchor.href) {
                e.preventDefault();
                window.open(anchor.href, "_blank", "noopener,noreferrer");
              }
            }}
          />
        </div>
      )}

      {mode === "source" && (
        <Textarea
          value={sourceHtml}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            onChange(e.target.value);
          }}
          className="min-h-0 flex-1 border-0 rounded-none resize-none focus-visible:ring-0 font-mono text-sm"
          style={{ minHeight: isReply ? undefined : minHeight }}
          spellCheck={false}
          readOnly={readOnly}
        />
      )}

      {mode === "visual" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <style>{`
            .email-rich-editor:empty::before {
              content: attr(data-placeholder);
              color: #9ca3af;
              pointer-events: none;
              ${isReply ? "font-style: italic;" : ""}
            }
            .email-rich-editor ul {
              list-style-type: disc;
              margin: 0.5em 0;
              padding-left: 1.5em;
            }
            .email-rich-editor ol {
              list-style-type: decimal;
              margin: 0.5em 0;
              padding-left: 1.5em;
            }
            .email-rich-editor li {
              display: list-item;
            }
            .email-rich-editor a {
              color: #662EBD;
              text-decoration: underline;
              cursor: pointer;
            }
          `}</style>
          <div
            ref={editorRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onInput={() => syncFromEditor(false)}
            onBlur={() => {
              isFocusedRef.current = false;
              if (mode === "visual") syncFromEditor(true);
            }}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            onSelect={saveSelection}
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
              if (readOnly || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                window.open(anchor.href, "_blank", "noopener,noreferrer");
              } else {
                e.preventDefault();
              }
            }}
            className={cn(
              "email-rich-editor min-h-0 flex-1 overflow-y-auto p-4 text-sm text-gray-800 outline-none focus:ring-0",
              isReply && "px-4 py-3",
            )}
            style={{
              minHeight: isReply ? undefined : minHeight,
              fontFamily,
              fontSize: `${fontSize}px`,
            }}
            data-placeholder={placeholder}
          />
        </div>
      )}

      <div className="shrink-0 border-t border-gray-200 bg-white px-2 py-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarBtn
            icon={<Bold className="h-4 w-4" />}
            onClick={() => exec("bold")}
            disabled={toolbarDisabled}
            title="Bold"
          />
          <ToolbarBtn
            icon={<Italic className="h-4 w-4" />}
            onClick={() => exec("italic")}
            disabled={toolbarDisabled}
            title="Italic"
          />
          <ToolbarBtn
            icon={<Underline className="h-4 w-4" />}
            onClick={() => exec("underline")}
            disabled={toolbarDisabled}
            title="Underline"
          />

          <Select
            value={fontFamily}
            onValueChange={applyFont}
            onOpenChange={handleToolbarControlOpen}
            disabled={toolbarDisabled}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs border-gray-200">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={fontSize}
            onValueChange={applySize}
            onOpenChange={handleToolbarControlOpen}
            disabled={toolbarDisabled}
          >
            <SelectTrigger className="h-8 w-[72px] text-xs border-gray-200">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block" />

          <ToolbarBtn
            icon={<AlignLeft className="h-4 w-4" />}
            onClick={() => exec("justifyLeft")}
            disabled={toolbarDisabled}
          />
          <ToolbarBtn
            icon={<AlignCenter className="h-4 w-4" />}
            onClick={() => exec("justifyCenter")}
            disabled={toolbarDisabled}
          />
          <ToolbarBtn
            icon={<AlignRight className="h-4 w-4" />}
            onClick={() => exec("justifyRight")}
            disabled={toolbarDisabled}
          />
          <ToolbarBtn
            icon={<AlignJustify className="h-4 w-4" />}
            onClick={() => exec("justifyFull")}
            disabled={toolbarDisabled}
          />
          <ToolbarBtn
            icon={<List className="h-4 w-4" />}
            onClick={() => insertList(false)}
            disabled={toolbarDisabled}
            title="Bulleted list"
          />
          <ToolbarBtn
            icon={<ListOrdered className="h-4 w-4" />}
            onClick={() => insertList(true)}
            disabled={toolbarDisabled}
            title="Numbered list"
          />
        </div>

        <div className="flex flex-wrap items-center gap-0.5">
          {isReply && onSend && (
            <Button
              type="button"
              className="mr-2 h-9 rounded-full bg-[#B794F4] px-5 text-white hover:bg-[#9F7AEA]"
              onClick={onSend}
              disabled={sending || sendDisabled}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          )}

          {isReply ? (
            <ToolbarBtn
              icon={<Type className="h-4 w-4" />}
              onClick={() => editorRef.current?.focus()}
              disabled={toolbarDisabled}
              title="Text formatting"
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={toolbarDisabled}
                  className={cn(
                    "h-8 w-8 rounded flex items-center justify-center text-gray-600",
                    toolbarDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-gray-100",
                  )}
                  title="Insert variable"
                >
                  <Braces className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                {MERGE_TAGS.map((tag) => (
                  <DropdownMenuItem
                    key={tag.value}
                    onClick={() => insertHtml(tag.value)}
                  >
                    {tag.label}{" "}
                    <span className="text-muted-foreground ml-1">{tag.value}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ToolbarBtn
            icon={<Paperclip className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={toolbarDisabled}
            title="Insert attachment link"
          />
          <ToolbarBtn
            icon={<Link2 className="h-4 w-4" />}
            onClick={openInsertLinkModal}
            disabled={toolbarDisabled}
            title="Insert link"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={toolbarDisabled}
                className={cn(
                  "h-8 w-8 rounded flex items-center justify-center text-gray-600",
                  toolbarDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-gray-100",
                )}
                title="Insert image"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                Upload image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openInsertImageModal}>
                Image from URL
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarBtn
            icon={<Code className="h-4 w-4" />}
            onClick={() => switchMode(mode === "source" ? "visual" : "source")}
            active={mode === "source"}
            title="HTML source"
          />

          {!isReply && (
            <div className="ml-auto flex items-center gap-1">
              {mode !== "preview" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[#8B5CF6]"
                  onClick={() => switchMode("preview")}
                >
                  Preview
                </Button>
              )}
              {mode === "preview" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => switchMode("visual")}
                >
                  Edit
                </Button>
              )}
              {!readOnly && onSave && (
                <Button
                  type="button"
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] h-8 rounded-md px-4"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <InsertLinkModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onInsert={confirmInsertLink}
        defaultText={linkDefaultText}
      />
      <InsertImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={confirmInsertImage}
      />
    </div>
  );
}

function ToolbarBtn({
  icon,
  onClick,
  disabled,
  active,
  title,
}: {
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onMouseDown={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      className={cn(
        "h-8 w-8 rounded flex items-center justify-center text-gray-600",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "hover:bg-gray-100",
        active && "bg-purple-100 text-[#8B5CF6]",
      )}
    >
      {icon}
    </button>
  );
}
