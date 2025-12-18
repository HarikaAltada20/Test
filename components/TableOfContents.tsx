"use client";

import ShareArticle from "./ShareArticle";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  items: TocItem[];
  articleUrl: string;
  title: string;
}

export function TableOfContents({
  items,
  articleUrl,
  title,
}: TableOfContentsProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      // Update URL without jumping
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-[#050b2a]/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.9)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm md:text-md font-semibold text-white">
          Table of contents
        </h2>
      </div>
      <div className="h-px bg-gradient-to-r from-purple-500/30 via-slate-600/40 to-orange-400/40" />
      <div
        className="space-y-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1
        scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100
        sm:hover:scrollbar-thumb-gray-400 sidebar-scrollbar"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            className={`group relative block rounded-md px-3 py-2 text-xs sm:text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white cursor-pointer ${
              item.level === 1
                ? "font-semibold"
                : item.level === 2
                ? "pl-5 text-slate-200/90"
                : "pl-8 text-slate-300/90"
            }`}
          >
            <span className="relative z-10">
              {item.text.length > 70
                ? item.text.slice(0, 70) + "..."
                : item.text}
            </span>
            <span className="pointer-events-none absolute inset-y-0 left-1 w-px bg-gradient-to-b from-purple-500/0 via-purple-500/70 to-orange-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
      <div>
        <ShareArticle articleUrl={articleUrl} title={title} />
      </div>
    </div>
  );
}
