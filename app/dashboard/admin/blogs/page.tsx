"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Edit } from "lucide-react";

type BlogStatus = "draft" | "published" | "archived";

interface BlogPostListItem {
  id: string;
  title: string;
  short_description?: string | null;
  category: string | null;
  // Supabase can return tags as string[], string, or null depending on casting
  tags: string[] | string | null;
  thumbnail?: string | null;
  thumbnail_url?: string | null;
  read_time_minutes: number | null;
  status: BlogStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const readIsDarkFromDom = () => {
  if (typeof window === "undefined") return false;
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }
  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

export default function AdminBlogsPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState<boolean>(readIsDarkFromDom);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sync with dashboard theme like other admin pages
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

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/admin/blogs");
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load blogs");
        }
        setPosts(json.posts || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load blogs");
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const stripHtml = (html: string | null | undefined): string => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").trim();
  };

  const normalizeTags = (
    tags: string[] | string | null | undefined
  ): string[] => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  };

  const refreshBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/blogs");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load blogs");
      }
      setPosts(json.posts || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };

  const publishPost = async (id: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch("/api/admin/blogs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status: "published" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to publish blog");
      }
      await refreshBlogs();
    } catch (e: any) {
      setError(e?.message || "Failed to publish blog");
    } finally {
      setUpdatingId(null);
    }
  };

  const deletePost = async (id: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/admin/blogs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete blog");
      }
      await refreshBlogs();
    } catch (e: any) {
      setError(e?.message || "Failed to delete blog");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-4 sm:pb-6 lg:pb-8 px-2 sm:px-4 lg:px-0">
      {/* Header: blog posts overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2
            className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Blog Posts
          </h2>
          <p
            className={cn(
              "mt-1 text-xs sm:text-sm lg:text-base",
              isDark ? "text-gray-400" : "text-muted-foreground"
            )}
          >
            Manage draft and published articles in one place.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button
            className="w-full sm:w-auto"
            onClick={() => router.push("/dashboard/admin/blogs/create")}
          >
            Create New Blog
          </Button>
        </div>
      </div>

      {/* Blog posts grid, similar feel to contest cards but without outer white card */}
      {loading ? (
        <div className="py-8 text-center text-sm sm:text-base">
          Loading blogs...
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-red-400">{error}</div>
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-sm sm:text-base">
          No blog posts yet.{" "}
          <button
            type="button"
            className={cn(
              "underline font-medium",
              isDark ? "text-purple-300" : "text-purple-700"
            )}
            onClick={() => router.push("/dashboard/admin/blogs/create")}
          >
            Create your first blog
          </button>
          .
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const status = (post.status || "").trim().toLowerCase();
            const isDraft = status === "draft" || !status;
            return (
              <Card
                key={post.id}
                className={cn(
                  "h-full border rounded-xl shadow-sm flex flex-col overflow-hidden",
                  isDark
                    ? "bg-[#170337] border-gray-700 text-white"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Thumbnail */}
                {(() => {
                  const thumb = post.thumbnail ?? post.thumbnail_url ?? null;
                  if (!thumb) return null;
                  return (
                    <div className="w-full h-56 bg-black/5 overflow-hidden">
                      <img
                        src={thumb}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })()}
                <CardContent className="p-4 flex flex-col gap-3 flex-1">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm sm:text-base line-clamp-2">
                        {post.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] sm:text-xs uppercase tracking-wide",
                          isDark
                            ? "border-gray-500 text-gray-200"
                            : "border-gray-300 text-gray-700"
                        )}
                      >
                        {post.category || "Uncategorized"}
                      </Badge>
                    </div>
                    {stripHtml(post.short_description).length > 0 && (
                      <p
                        className={cn(
                          "text-[11px] sm:text-xs mt-1 line-clamp-3",
                          isDark ? "text-gray-200" : "text-gray-700"
                        )}
                      >
                        {stripHtml(post.short_description)}
                      </p>
                    )}
                    <div
                      className={cn(
                        "text-[11px] sm:text-xs flex flex-wrap items-center gap-2",
                        isDark ? "text-gray-300" : "text-gray-600"
                      )}
                    >
                      <span>Created: {formatDate(post.created_at)}</span>
                      <span>•</span>
                      <span>Last updated: {formatDate(post.updated_at)}</span>
                      {post.read_time_minutes ? (
                        <>
                          <span>•</span>
                          <span>{post.read_time_minutes} min read</span>
                        </>
                      ) : null}
                    </div>
                    {normalizeTags(post.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {normalizeTags(post.tags).map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px]",
                              isDark
                                ? "bg-[#2B0A5A] text-purple-100"
                                : "bg-purple-50 text-purple-700"
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Badge
                      className={cn(
                        "text-[10px] sm:text-xs",
                        isDraft
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800",
                        isDark &&
                          (isDraft
                            ? "bg-yellow-900 text-yellow-200"
                            : "bg-green-900 text-green-200")
                      )}
                    >
                      {isDraft ? "Draft" : "Published"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {isDraft && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 bg-[#6C43D0] hover:bg-[#6C43D0] text-white transition-all duration-200 hover:scale-105"
                            onClick={() =>
                              router.push(
                                `/dashboard/admin/blogs/${post.id}/edit`
                              )
                            }
                          >
                            <Edit className="h-4 w-4" />
                            <span className="hidden sm:inline font-medium">
                              Edit
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === post.id}
                            onClick={() => publishPost(post.id)}
                          >
                            {updatingId === post.id
                              ? "Publishing..."
                              : "Publish"}
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        disabled={updatingId === post.id}
                        onClick={() => deletePost(post.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
