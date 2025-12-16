"use client";

import {
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Upload, Trash } from "lucide-react";
import type { NovelEditorRef } from "@/components/novel-editor";

const NovelEditor = dynamic(() => import("@/components/novel-editor"), {
  ssr: false,
});

const readIsDarkFromDom = () => {
  if (typeof window === "undefined") return false;
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }
  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

interface EditBlogPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBlogPage({ params }: EditBlogPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const editorRef = useRef<NovelEditorRef | null>(null);
  const supabase = createClient();

  const [isDark, setIsDark] = useState<boolean>(readIsDarkFromDom);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [readTime, setReadTime] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync theme
  useLayoutEffect(() => {
    const checkTheme = () => {
      const newIsDark = readIsDarkFromDom();
      setIsDark((prev) => (prev === newIsDark ? prev : newIsDark));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  // Load existing blog data
  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/admin/blogs?id=${encodeURIComponent(id)}`
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load blog");
        }
        const post = json.post;
        setTitle(post.title || "");
        setCategory(post.category || "");
        setTags(
          Array.isArray(post.tags) ? post.tags.join(", ") : post.tags || ""
        );
        setExcerpt(post.short_description || "");
        setReadTime(
          typeof post.read_time_minutes === "number"
            ? String(post.read_time_minutes)
            : ""
        );
        if (post.thumbnail) {
          setThumbnailPreview(post.thumbnail);
        }
        // Set content into NovelEditor once it mounts
        // Use a longer timeout to ensure the editor is fully initialized
        setTimeout(() => {
          if (editorRef.current && post.content) {
            editorRef.current.setContent(post.content);
          }
        }, 100);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load blog");
        router.push("/dashboard/admin/blogs");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBlog();
    }
  }, [id, router]);

  const handleThumbnailInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview(null);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(
        "Thumbnail must be 5MB or smaller. Please choose a smaller file."
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setThumbnailFile(file);
    const previewUrl = URL.createObjectURL(file);
    setThumbnailPreview(previewUrl);
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    if (thumbnailPreview && !thumbnailPreview.startsWith("http")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setThumbnailPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorRef.current) {
      toast.error("Editor not ready yet. Please try again.");
      return;
    }

    const { html } = editorRef.current.getContent();
    // Preserve HTML formatting for proper paragraph structure
    const contentText = html.trim();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!contentText || contentText === "<p></p>") {
      toast.error("Content is required");
      return;
    }

    setSaving(true);
    try {
      let uploadedThumbnailUrl: string | undefined;

      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split(".").pop() || "jpg";
        const timestamp = Date.now();
        const fileName = `blog_thumbnails/${id}_${timestamp}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("contest-assets")
          .upload(fileName, thumbnailFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("contest-assets").getPublicUrl(fileName);

        uploadedThumbnailUrl = publicUrl;
      }

      const body: any = {
        id,
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        contentHtml: contentText,
        category: category.trim() || undefined,
        tags: tags.trim() || undefined,
        readTimeMinutes: readTime ? Number(readTime) : undefined,
      };

      if (uploadedThumbnailUrl !== undefined) {
        body.thumbnailUrl = uploadedThumbnailUrl;
      }

      const res = await fetch("/api/admin/blogs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update blog post");
      }

      toast.success("Blog post updated successfully");
      router.push("/dashboard/admin/blogs");
    } catch (error: any) {
      toast.error(
        error?.message || "An unexpected error occurred while updating blog"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-sm sm:text-base">
        Loading blog...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-4 sm:pb-6 lg:pb-8 px-2 sm:px-4 lg:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div>
          <h2
            className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Edit Blog Post
          </h2>
          <p
            className={cn(
              "mt-1 text-xs sm:text-sm lg:text-base",
              isDark ? "text-gray-400" : "text-muted-foreground"
            )}
          >
            Update the title, details, and content for this blog post.
          </p>
        </div>
      </div>

      <Card
        className={cn(
          "shadow-[0px_5px_20px_0px_#0000000D] rounded-xl border",
          isDark ? "bg-[#170337] border-gray-700 text-white" : "bg-white"
        )}
      >
        <CardHeader
          className={cn(
            "pb-3 sm:pb-4 border-b",
            isDark ? "border-gray-700" : "border-gray-200"
          )}
        >
          <CardTitle className="text-lg sm:text-xl">
            Blog details & content
          </CardTitle>
          <CardDescription
            className={cn(
              "text-xs sm:text-sm",
              isDark ? "text-gray-300" : "text-muted-foreground"
            )}
          >
            Edit the title, metadata, and rich content for this article.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="E.g. How to get high-quality UGC for ads at scale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(
                    isDark
                      ? "bg-[#170337] border-gray-600 text-white placeholder:text-gray-400"
                      : ""
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. UGC, Influencer Marketing, eCommerce"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    isDark
                      ? "bg-[#170337] border-gray-600 text-white placeholder:text-gray-400"
                      : ""
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. TikTok hooks, UGC platform, creator marketing"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={cn(
                    isDark
                      ? "bg-[#170337] border-gray-600 text-white placeholder:text-gray-400"
                      : ""
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="readTime">Read time (minutes)</Label>
                <Input
                  id="readTime"
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  value={readTime}
                  onChange={(e) => setReadTime(e.target.value)}
                  className={cn(
                    isDark
                      ? "bg-[#170337] border-gray-600 text-white placeholder:text-gray-400"
                      : ""
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail image</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer",
                  isDark
                    ? "border-slate-600 bg-[#170337]"
                    : "border-gray-300 bg-white"
                )}
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Upload thumbnail"
              >
                {thumbnailPreview ? (
                  <div className="relative">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="mx-auto max-h-64 object-contain rounded"
                    />
                    <div className="mt-2 flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        {thumbnailFile?.name || "Selected thumbnail"}
                        {thumbnailFile?.size
                          ? ` · ${(thumbnailFile.size / (1024 * 1024)).toFixed(
                              2
                            )}MB`
                          : ""}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeThumbnail();
                        }}
                        className="text-purple-500"
                      >
                        <Trash className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40">
                    <Upload className="mx-auto text-gray-500 text-3xl mb-2" />
                    <p className="text-md font-medium mb-1">
                      Drag, drop or browse{" "}
                      <span className="text-purple-500">thumbnail</span>
                    </p>
                    <p className="text-sm text-gray-500 mb-2">
                      Max file size: 5MB
                    </p>
                    <Button
                      className={cn(
                        "px-4 py-3 rounded-lg text-sm hover:text-white",
                        isDark
                          ? "bg-[#7F39EC] text-white"
                          : "bg-[#4A00BE] text-white"
                      )}
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Choose Image
                    </Button>
                  </div>
                )}
                <Input
                  ref={fileInputRef}
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailInputChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Short description / excerpt</Label>
              <Textarea
                id="excerpt"
                placeholder="Short summary shown in blog cards and previews"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                className={cn(
                  isDark
                    ? "bg-[#170337] border-gray-600 text-white placeholder:text-gray-400"
                    : ""
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Content *</Label>
              <div
                className={cn(
                  "rounded-xl overflow-hidden border",
                  isDark
                    ? "border-gray-700 bg-[#170337]"
                    : "border-gray-200 bg-white"
                )}
              >
                <NovelEditor
                  ref={editorRef}
                  value=""
                  height="400px"
                  isDark={isDark}
                />
              </div>
              <p
                className={cn(
                  "text-xs sm:text-sm",
                  isDark ? "text-gray-300" : "text-muted-foreground"
                )}
              >
                Use headings, lists, and storytelling similar to Insense blog
                articles to make the content scannable and engaging.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
