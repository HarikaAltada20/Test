import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ShareArticle from "@/components/ShareArticle";

// Always fetch fresh data so newly published blogs are visible immediately
export const revalidate = 0;

interface BlogPageProps {
  params: { id: string };
}

// Extract headings from HTML content for table of contents
const extractHeadings = (
  html: string | null | undefined
): Array<{ id: string; text: string; level: number }> => {
  if (!html) return [];

  const headings: Array<{ id: string; text: string; level: number }> = [];

  // Extract h1, h2, h3 tags
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  let index = 0;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1].substring(1));
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    if (text) {
      index++;
      headings.push({
        id: `heading-${index}`,
        text,
        level,
      });
    }
  }

  return headings;
};

// Add IDs to headings in HTML for anchor navigation
const addHeadingIds = (html: string | null | undefined): string => {
  if (!html) return "";

  let processedHtml = html;
  let index = 0;

  // Add IDs to h1, h2, h3 tags
  processedHtml = processedHtml.replace(
    /<(h[1-3])([^>]*)>(.*?)<\/h[1-3]>/gi,
    (match, tag, attributes, content) => {
      // Check if ID already exists
      if (attributes && attributes.includes("id=")) {
        return match;
      }
      index++;
      const id = `heading-${index}`;
      return `<${tag}${attributes} id="${id}">${content}</${tag}>`;
    }
  );

  return processedHtml;
};

export default async function BlogDetailPage({ params }: BlogPageProps) {
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, short_description, content, category, tags, thumbnail, read_time_minutes, status, published_at, created_at"
    )
    .eq("id", params.id)
    .eq("status", "published")
    .single();

  if (error || !post) {
    console.error("Error loading blog post:", error);
    notFound();
  }

  // Extract headings for table of contents
  const headings = extractHeadings(post.content);

  // Build table of contents with title and headings
  const tocItems = [{ id: "title", text: post.title, level: 1 }, ...headings];

  // Add IDs to headings in content for anchor navigation
  const contentWithIds = addHeadingIds(post.content);

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const articleUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/blog/${
    post.id
  }`;

  return (
    <div className="min-h-screen bg-[#000825] text-white">
      <div className="w-full max-w-[1300px] mx-auto px-4 py-10 lg:py-14">
        {/* Back arrow */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Blogs</span>
        </Link>
        {/* Header section with image */}
        <header className="mb-10 grid gap-6 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="space-y-8">
            <p className="text-xs uppercase tracking-wide text-purple-400 font-semibold">
              {post.category || "Blog"}
            </p>
            <h1
              id="title"
              className="text-4xl lg:text-5xl font-bold tracking-wide text-white scroll-mt-24"
            >
              {post.title}
            </h1>
            {post.short_description && (
              <p className="text-lg lg:text-xl text-slate-300 tracking-wide">
                {post.short_description.replace(/<[^>]*>/g, "")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>{formatDate(post.published_at || post.created_at)}</span>
              {post.read_time_minutes ? (
                <span>• {post.read_time_minutes} min read</span>
              ) : null}
            </div>
          </div>
          {post.thumbnail && (
            <div className="w-[600px] h-[400px] rounded-xl overflow-hidden bg-black/5">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </header>

        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] pt-20">
          {/* Table of contents - Sticky */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 self-start">
              <h2 className="text-lg font-semibold mb-4 text-white">
                Table of contents
              </h2>
              <div className="space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
                {tocItems.map((item, idx) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block text-sm py-2 px-3 rounded-md hover:bg-slate-800/50 transition-colors text-slate-300 hover:text-white ${
                      item.level === 1
                        ? "font-semibold"
                        : item.level === 2
                        ? "pl-4"
                        : "pl-6"
                    }`}
                  >
                    {item.text.length > 60
                      ? item.text.slice(0, 60) + "..."
                      : item.text}
                  </a>
                ))}
              </div>
              <ShareArticle articleUrl={articleUrl} title={post.title} />
            </div>
            
          </aside>

          {/* Article content - Scrollable */}
          <article className="prose prose-lg prose-invert max-w-none">
            <div
              className="text-slate-300 [&_h1]:text-white [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:scroll-mt-24 [&_h2]:text-white [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h3]:text-white [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_p]:text-slate-300 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:text-slate-300 [&_ul]:mb-4 [&_ul]:pl-6 [&_ol]:text-slate-300 [&_ol]:mb-4 [&_ol]:pl-6 [&_li]:text-slate-300 [&_li]:mb-2 [&_strong]:text-white [&_strong]:font-semibold [&_em]:text-slate-200 [&_blockquote]:text-slate-300 [&_blockquote]:border-l-4 [&_blockquote]:border-purple-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:text-purple-300 [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-6 [&_img]:mx-auto [&_img]:block"
              dangerouslySetInnerHTML={{ __html: contentWithIds }}
            />
          </article>
        </div>

        
      </div>
    </div>
  );
}
