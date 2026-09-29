"use client";

import Link from "next/link";
import { useState } from "react";

type BlogPost = {
  id: string;
  title: string;
  short_description: string | null;
  thumbnail: string | null;
  read_time_minutes: number | null;
  published_at: string | null;
  status?: string | null;
  category: string | null;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  // Use a fixed locale so server and client render the same string and avoid hydration mismatches
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
};

type BlogPostsGridProps = {
  posts: BlogPost[];
};

export function BlogPostsGrid({ posts }: BlogPostsGridProps) {
  const [visibleCount, setVisibleCount] = useState(6);

  // Filter out any draft posts (safety check)
  const publishedPosts = posts.filter(
    (post) => post.status === "published" && post.published_at
  );

  const visiblePosts = publishedPosts.slice(0, visibleCount);
  const hasMore = visibleCount < publishedPosts.length;

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {visiblePosts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.id}`}
            className="group relative rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:border-white/20"
          >

            {post.thumbnail && (
              <div className="relative w-full h-72 bg-slate-900/10 overflow-hidden">
                {/* light gradient only at bottom for text readability */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                <img
                  src={post.thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                />

                {/* top-right status / read-time pill when image exists */}
                <div className="absolute top-3 right-3 flex gap-2 text-[11px] font-medium">
                  {post.read_time_minutes ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/80 border border-white/20 px-2.5 py-1 text-white shadow-lg backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                      {post.read_time_minutes} min read
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            <div className="relative p-7 flex flex-col gap-4 flex-1">
              {/* Category badge above title */}
              {post.category && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
                  {post.category}
                </span>
              )}

              <h2 className="font-semibold text-lg lg:text-xl line-clamp-2 text-white group-hover:text-gray-300 transition-colors duration-300">
                {post.title}
              </h2>

              {stripHtml(post.short_description).length > 0 && (
                <p className="text-sm lg:text-[15px] text-[#8E8E8E] leading-relaxed line-clamp-3 transition-colors">
                  {stripHtml(post.short_description)}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-800/80 text-[11px] uppercase tracking-[0.16em]">
                <span className="inline-flex items-center gap-2 text-slate-400/90">
                  <span className="h-1 w-1 rounded-full bg-[#7F39EC] shadow-[0_0_10px_rgba(127,57,236,0.9)]" />
                  <span>{formatDate(post.published_at)}</span>
                </span>

                <span className="inline-flex items-center gap-1 text-slate-400/90 group-hover:text-[#C4A3FF] transition-colors">
                  <span className="text-[10px]">Read article</span>
                  <span className="text-xs translate-y-px transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-10">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 6)}
            className="rounded-3xl relative text-white font-bold px-8 py-2 text-lg overflow-hidden flex items-center gap-2"
            style={{
              background:
                "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
            }}
          >
            <div className="scan-line"></div>
            View more
          </button>
        </div>
      )}
    </>
  );
}
