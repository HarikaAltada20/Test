"use client";

import { useCallback } from "react";
import { Share2 } from "lucide-react";

interface ShareArticleProps {
  articleUrl: string;
  title: string;
}

export default function ShareArticle({ articleUrl, title }: ShareArticleProps) {
  const handleShare = useCallback(async () => {
    const shareUrl = articleUrl;

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title,
          text: title,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        // Basic fallback feedback
        alert("Article link copied to clipboard");
      }
    } catch {
      // Ignore share/copy cancellations or failures
    }
  }, [articleUrl, title]);

  return (
    <div className="mt-10 border-t border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4">
      <span className="text-sm text-slate-400">Share this article</span>
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-2 bg-[#6C43D0] hover:bg-[#6C43D0] text-white px-3 h-9 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
      >
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </button>
    </div>
  );
}
