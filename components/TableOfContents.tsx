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
    <div className="rounded-[20px] border border-white/10 bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm md:text-base font-semibold text-white">
          Table of contents
        </h2>
      </div>
      <div className="h-px bg-white/10" />
      <div
        className="space-y-1.5 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1
        scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent
        sm:hover:scrollbar-thumb-gray-500 sidebar-scrollbar"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            className={`group relative block rounded-md px-3 py-2 text-xs sm:text-sm transition-colors hover:bg-white/5 hover:text-white cursor-pointer ${
              item.level === 1
                ? "font-semibold text-white"
                : item.level === 2
                ? "pl-5 text-[#8E8E8E]"
                : "pl-8 text-[#8E8E8E]"
            }`}
          >
            <span className="relative z-10">
              {item.text.length > 70
                ? item.text.slice(0, 70) + "..."
                : item.text}
            </span>
            <span className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-r-md bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
      <div>
        <ShareArticle articleUrl={articleUrl} title={title} />
      </div>
    </div>
  );
}
