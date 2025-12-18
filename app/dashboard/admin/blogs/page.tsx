"use client";

import { useEffect, useLayoutEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Edit,
  Plus,
  Trash2,
  Eye,
  Loader2,
  BookOpen,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(9);
  const [creatingLoading, setCreatingLoading] = useState(false);

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

  // Reset to first page whenever tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Calculate filtered posts based on active tab
  const filteredPosts = useMemo(() => {
    if (activeTab === "draft") {
      return posts.filter(
        (p) => (p.status || "").trim().toLowerCase() === "draft" || !p.status
      );
    } else if (activeTab === "published") {
      return posts.filter(
        (p) => (p.status || "").trim().toLowerCase() === "published"
      );
    }
    return posts;
  }, [posts, activeTab]);

  // Calculate pagination
  const total = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const paginatedPosts = filteredPosts.slice((page - 1) * limit, page * limit);

  const publishPost = async (id: string) => {
    try {
      setUpdatingId(id);

      // First, fetch the full blog post data to validate all required fields
      const fetchRes = await fetch(
        `/api/admin/blogs?id=${encodeURIComponent(id)}`
      );
      const fetchJson = await fetchRes.json();

      if (!fetchRes.ok || !fetchJson.success || !fetchJson.post) {
        throw new Error(fetchJson.error || "Failed to fetch blog post");
      }

      const post = fetchJson.post;

      // Validate all required fields before publishing
      if (!post.title || !post.title.trim()) {
        toast.error("Title is required to publish");
        setUpdatingId(null);
        return;
      }

      const contentText = stripHtml(post.content);
      if (
        !post.content ||
        !post.content.trim() ||
        post.content.trim() === "<p></p>" ||
        !contentText
      ) {
        toast.error("Content is required to publish");
        setUpdatingId(null);
        return;
      }

      if (!post.category || !post.category.trim()) {
        toast.error("Category is required to publish");
        setUpdatingId(null);
        return;
      }

      if (!post.short_description || !post.short_description.trim()) {
        toast.error("Short description is required to publish");
        setUpdatingId(null);
        return;
      }

      if (
        !post.read_time_minutes ||
        post.read_time_minutes <= 0 ||
        isNaN(post.read_time_minutes)
      ) {
        toast.error("Valid read time (in minutes) is required to publish");
        setUpdatingId(null);
        return;
      }

      if (!post.thumbnail && !post.thumbnail_url) {
        toast.error("Thumbnail image is required to publish");
        setUpdatingId(null);
        return;
      }

      // All validations passed, proceed with publishing
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
      toast.success("Blog post published successfully");
      await refreshBlogs();
    } catch (e: any) {
      const errorMessage = e?.message || "Failed to publish blog";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdatingId(null);
    }
  };

  const deletePost = async (id: string) => {
    try {
      setDeletingId(id);
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
      setDeletingId(null);
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
            Blogs
          </h2>
          {/* <p
            className={cn(
              "mt-1 text-xs sm:text-sm lg:text-base",
              isDark ? "text-gray-400" : "text-muted-foreground"
            )}
          >
            Manage draft and published articles in one place.
          </p> */}
        </div>
        <div className="flex-shrink-0">
          <Button
            className="w-full text-md sm:w-auto"
            onClick={() => {
              setCreatingLoading(true);
              router.push("/dashboard/admin/blogs/create");
            }}
          >
            {creatingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Create Blog</span>
          </Button>
        </div>
      </div>

      {/* EnhancedTabs for filtering */}
      {!loading && !error && posts.length > 0 && (
        <div className="w-full">
          <EnhancedTabs
            tabs={[
              {
                id: "all",
                label: `All (${posts.length})`,
              },
              {
                id: "draft",
                label: `Draft (${
                  posts.filter(
                    (p) =>
                      (p.status || "").trim().toLowerCase() === "draft" ||
                      !p.status
                  ).length
                })`,
              },
              {
                id: "published",
                label: `Published (${
                  posts.filter(
                    (p) => (p.status || "").trim().toLowerCase() === "published"
                  ).length
                })`,
              },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="w-full"
            isDark={isDark}
          />
        </div>
      )}

      {/* Blog posts grid, similar feel to contest cards but without outer white card */}
      {loading ? (
        <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
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
            Create blogs
          </button>
          .
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.length === 0 ? (
              <div className="col-span-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center text-sm sm:text-base">
                <Inbox className="h-16 w-16 text-gray-400" />
                <span>
                  {activeTab === "draft"
                    ? "No draft posts yet."
                    : activeTab === "published"
                    ? "No published posts yet."
                    : "No blog posts yet."}
                </span>
              </div>
            ) : (
              paginatedPosts.map((post) => {
                const status = (post.status || "").trim().toLowerCase();
                const isDraft = status === "draft" || !status;
                return (
                  <Card
                    key={post.id}
                    className={cn(
                      "h-full border rounded-xl shadow-lg flex flex-col overflow-hidden cursor-pointer",
                      isDark
                        ? "bg-[#06021D] border-gray-700 text-white"
                        : "bg-white border-gray-200"
                    )}
                    onClick={() => {
                      if (isDraft) {
                        router.push(`/dashboard/admin/blogs/${post.id}/edit`);
                      } else {
                        router.push(`/blog/${post.id}`);
                      }
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-72 bg-black/5 overflow-hidden relative">
                      {(() => {
                        const thumb =
                          post.thumbnail ?? post.thumbnail_url ?? null;
                        if (thumb) {
                          return (
                            <img
                              src={thumb}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          );
                        }
                        return null;
                      })()}
                      {/* Status badge overlay - top right */}
                      <div className="absolute top-3 right-3 flex flex-wrap gap-1">
                        <Badge className="bg-[#7F39EC] text-white px-3 py-1 text-[12px] border-0">
                          {isDraft ? "Draft" : "Published"}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 flex flex-col gap-3 flex-1">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold line-clamp-2">
                            {post.title}
                          </span>
                          {post.category && post.category.trim() && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] sm:text-xs uppercase tracking-wide",
                                isDark
                                  ? "border-gray-500 text-gray-200"
                                  : "border-gray-300 text-gray-700"
                              )}
                            >
                              {post.category}
                            </Badge>
                          )}
                        </div>
                        {stripHtml(post.short_description).length > 0 && (
                          <p
                            className={cn(
                              "text-md mt-1 line-clamp-3",
                              isDark ? "text-gray-200" : "text-gray-700"
                            )}
                          >
                            {stripHtml(post.short_description)}
                          </p>
                        )}
                        <div
                          className={cn(
                            "text-[11px] sm:text-sm flex flex-wrap items-center gap-2",
                            isDark ? "text-gray-300" : "text-gray-600"
                          )}
                        >
                          <span>
                            {formatDate(post.published_at || post.updated_at)}
                          </span>
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
                      <div className="flex gap-2 items-center pt-1">
                        {isDraft ? (
                          <>
                            <button
                              className={cn(
                                "flex flex-[1.8] items-center justify-center gap-2 px-3 py-3 rounded-full text-[13px]",
                                isDark
                                  ? "bg-[#7F39EC] text-white"
                                  : "bg-[#D9C0FF61] text-[#7F39EC]"
                              )}
                              disabled={
                                updatingId === post.id || deletingId === post.id
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                publishPost(post.id);
                              }}
                            >
                              {updatingId === post.id && deletingId !== post.id
                                ? "Publishing..."
                                : "Publish"}
                            </button>
                            <button
                              className={cn(
                                "flex flex-[0.6] items-center border justify-center gap-2 px-3 py-3 rounded-full text-[13px]",
                                isDark
                                  ? "border-purple-400 text-purple-400"
                                  : "border-purple-500 text-purple-500"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/dashboard/admin/blogs/${post.id}/edit`
                                );
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <Button
                              variant="outline"
                              size="md"
                              className={cn(
                                "border text-[14px] flex-[0.6]",
                                isDark
                                  ? "text-purple-400 border-gray-600"
                                  : "text-purple-500"
                              )}
                              disabled={
                                deletingId === post.id || updatingId === post.id
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(post.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mb-[2px]" />
                              {deletingId === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              className={cn(
                                "flex flex-[1.8] items-center justify-center gap-2 px-3 py-3 rounded-full text-[13px]",
                                isDark
                                  ? "bg-[#7F39EC] text-white"
                                  : "bg-[#D9C0FF61] text-[#7F39EC]"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/blog/${post.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">View Article</span>
                            </button>
                            <button
                              className={cn(
                                "flex flex-[0.6] items-center border justify-center gap-2 px-3 py-3 rounded-full text-[13px]",
                                isDark
                                  ? "border-purple-400 text-purple-400"
                                  : "border-purple-500 text-purple-500"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/dashboard/admin/blogs/${post.id}/edit`
                                );
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <Button
                              variant="outline"
                              size="md"
                              className={cn(
                                "border text-[14px] flex-[0.6]",
                                isDark
                                  ? "text-purple-400 "
                                  : "text-purple-500"
                              )}
                              disabled={
                                deletingId === post.id || updatingId === post.id
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(post.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mb-[2px]" />
                              {deletingId === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {total > 0 && (
            <div className="mt-6">
              <PaginationControls
                page={page}
                limit={limit}
                total={total}
                totalPages={totalPages}
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onPageChange={setPage}
                onLimitChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
                loading={loading}
                isDark={isDark}
                showResultInfo={true}
                showEdgeButtons={false}
                showPrevNextButtons={true}
                showPageSizeSelector={true}
                pageSizeOptions={[9, 15, 21, 30]}
              />
            </div>
          )}

          {/* Delete confirmation dialog */}
          <Dialog
            open={!!confirmDeleteId}
            onOpenChange={(open) => {
              if (!open) setConfirmDeleteId(null);
            }}
            isdark={isDark}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete blog post?</DialogTitle>
                <DialogDescription className="text-md">
                  Are you sure you want to delete this blog? This action cannot
                  be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  className={cn(
                    "w-full text-md rounded-full",
                    isDark
                      ? "bg-[#7F39EC] py-3"
                      : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
                  )}
                  onClick={async () => {
                    if (!confirmDeleteId) return;
                    await deletePost(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                  disabled={!!deletingId}
                >
                  {deletingId ? "Deleting..." : "Delete"}
                </Button>
                <Button
                  className={cn(
                    "w-full text-md rounded-full",
                    isDark
                      ? "py-3 border border-[#FF5353] text-[#FF5353]"
                      : "bg-[#FF323224] text-[#E50000] py-4"
                  )}
                  variant="outline"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={!!deletingId}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
