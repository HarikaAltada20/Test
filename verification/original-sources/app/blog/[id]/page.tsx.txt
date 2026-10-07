import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TableOfContents } from "@/components/TableOfContents";
import type { Metadata } from "next";

// Always fetch fresh data so newly published blogs are visible immediately
export const revalidate = 0;

interface BlogPageProps {
  params: { id: string };
}

// Helper function to strip HTML tags
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
};

// Generate dynamic metadata for SEO
export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const supabase = await createClient();
  const { id } = await params;

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, short_description, thumbnail, category, published_at")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!post) {
    return {
      title: "Blog Post Not Found | Game Of Creators",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  const articleUrl = `${siteUrl}/blog/${id}`;
  const description =
    stripHtml(post.short_description) ||
    `Read ${post.title} on Game Of Creators - Creator marketing insights for brands and creators.`;
  const title = `${post.title} | Game Of Creators Blog`;
  const imageUrl = post.thumbnail || `${siteUrl}/goc_ogc.png`;

  return {
    title,
    description,
    keywords: [
      "creator marketing",
      "influencer marketing",
      "content creation",
      "brand marketing",
      "social media marketing",
      post.category || "blog",
    ]
      .filter(Boolean)
      .join(", "),
    openGraph: {
      title,
      description,
      url: articleUrl,
      siteName: "Game Of Creators",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: "en_US",
      type: "article",
      publishedTime: post.published_at || undefined,
      section: post.category || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      creator: "@gameofcreators",
    },
    alternates: {
      canonical: articleUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
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

// Ensure all images in HTML content have alt text for SEO
const ensureImageAltText = (
  html: string | null | undefined,
  fallbackAlt: string
): string => {
  if (!html) return "";

  return html.replace(/<img([^>]*?)>/gi, (match, attributes) => {
    // Check if alt attribute already exists
    if (attributes && /alt\s*=\s*["']([^"']*)["']/i.test(attributes)) {
      // Alt exists, but check if it's empty
      const altMatch = attributes.match(/alt\s*=\s*["']([^"']*)["']/i);
      if (altMatch && altMatch[1] && altMatch[1].trim()) {
        return match; // Alt text exists and is not empty
      }
      // Alt exists but is empty, replace it
      return match.replace(/alt\s*=\s*["'][^"']*["']/i, `alt="${fallbackAlt}"`);
    }
    // No alt attribute, add it
    return `<img${attributes} alt="${fallbackAlt}">`;
  });
};

export default async function BlogDetailPage({ params }: BlogPageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, short_description, content, category, thumbnail, read_time_minutes, status, published_at, created_at"
    )
    .eq("id", id)
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

  // Ensure all images have alt text for SEO
  const contentWithAltText = ensureImageAltText(
    contentWithIds,
    post.title || "Blog post image"
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  const articleUrl = `${siteUrl}/blog/${post.id}`;

  // Strip HTML from description for structured data
  const plainDescription =
    stripHtml(post.short_description) ||
    `Read ${post.title} on Game Of Creators - Creator marketing insights for brands and creators.`;

  // Structured data (JSON-LD) for SEO
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: plainDescription,
    image: post.thumbnail ? [post.thumbnail] : [`${siteUrl}/goc_ogc.png`],
    datePublished: post.published_at || post.created_at,
    dateModified: post.published_at || post.created_at,
    author: {
      "@type": "Organization",
      name: "Game Of Creators",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Game Of Creators",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/goc_ogc.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    articleSection: post.category || "Blog",
    keywords: [
      "creator marketing",
      "influencer marketing",
      "content creation",
      post.category || "",
    ]
      .filter(Boolean)
      .join(", "),
  };

  // Breadcrumb structured data for better SEO
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbStructuredData),
        }}
      />
      <div className="min-h-screen bg-[#000825] text-white border-b border-[#A87313]">
        {/* Subtle radial background glow to match hero theme */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-60 w-60 sm:h-80 sm:w-80 -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
          <div className="absolute bottom-0 right-4 sm:right-10 h-48 w-48 sm:h-72 sm:w-72 rounded-full bg-orange-500/20 blur-3xl" />
        </div>

        <div className="w-full max-w-[1350px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8 md:py-10 lg:py-16">
          {/* Back arrow */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-4 sm:mb-6 lg:mb-10 transition-colors group"
          >
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900/60 group-hover:border-purple-500/70 group-hover:bg-purple-600/20 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:-translate-x-1 transition-transform" />
            </span>
            <span className="text-[10px] sm:text-xs uppercase mt-1 tracking-[0.18em] text-slate-400 font-semibold whitespace-nowrap">
              Back to Blogs
            </span>
          </Link>

          {/* Header section with image */}
          <header className="mb-8 sm:mb-10 md:mb-12 grid gap-6 sm:gap-8 lg:grid-cols-[1fr_650px] items-center">
            <div className="space-y-4 sm:space-y-6 md:space-y-8 order-2 lg:order-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 sm:px-4 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-300">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.85)]" />
                {post.category || "Blog"}
              </p>
              <h1
                id="title"
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.5] sm:leading-[1.6] md:leading-[1.55] lg:leading-[1.5] text-white scroll-mt-20 sm:scroll-mt-24 drop-shadow-[0_2px_20px_rgba(255,255,255,0.15)]"
              >
                {post.title}
              </h1>
              {post.short_description && (
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-300/90 tracking-[0.03em] leading-relaxed">
                  {post.short_description.replace(/<[^>]*>/g, "")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-slate-900/70 px-2.5 sm:px-3 py-1 border border-slate-700/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  {formatDate(post.published_at || post.created_at)}
                </span>
                {post.read_time_minutes ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 sm:px-3 py-1 border border-slate-700/60">
                    <span className="h-1 w-1 rounded-full bg-slate-500" />
                    {post.read_time_minutes} min
                  </span>
                ) : null}
              </div>
            </div>
            {post.thumbnail && (
              <div className="relative w-full max-w-[650px] mx-auto lg:mx-0 order-1 lg:order-2">
                <div className="pointer-events-none absolute -inset-0.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-purple-500/50 via-orange-400/40 to-amber-400/40 opacity-60 blur-xl" />
                <div className="relative w-full h-[250px] sm:h-[300px] md:h-[450px] rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-900/40 shadow-[0_22px_80px_rgba(15,23,42,0.9)]">
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
                </div>
              </div>
            )}
          </header>

          <div className="grid gap-6 sm:gap-8 md:gap-10 lg:grid-cols-[260px_minmax(0,1fr)] pt-8 sm:pt-12 md:pt-16">
            {/* Table of contents - Sticky */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 xl:top-28 self-start">
                <TableOfContents
                  items={tocItems}
                  articleUrl={articleUrl}
                  title={post.title}
                />
              </div>
            </aside>

            {/* Article content - Scrollable */}
            <article className="border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6 lg:p-8">
              <div
                className="prose prose-sm sm:prose-base md:prose-lg max-w-none text-white [&_h1]:text-white [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 sm:[&_h1]:mt-8 [&_h1]:mb-3 sm:[&_h1]:mb-4 [&_h1]:scroll-mt-20 sm:[&_h1]:scroll-mt-24 [&_h2]:text-white [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-5 sm:[&_h2]:mt-6 [&_h2]:mb-2 sm:[&_h2]:mb-3 [&_h2]:scroll-mt-20 sm:[&_h2]:scroll-mt-24 [&_h3]:text-white [&_h3]:text-lg sm:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:scroll-mt-20 sm:[&_h3]:scroll-mt-24 [&_p]:text-white [&_p]:text-sm sm:[&_p]:text-base [&_p]:mb-3 sm:[&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:text-white [&_ul]:text-sm sm:[&_ul]:text-base [&_ul]:mb-3 sm:[&_ul]:mb-4 [&_ul]:pl-4 sm:[&_ul]:pl-6 [&_ol]:text-white [&_ol]:text-sm sm:[&_ol]:text-base [&_ol]:mb-3 sm:[&_ol]:mb-4 [&_ol]:pl-4 sm:[&_ol]:pl-6 [&_li]:text-white [&_li]:mb-1.5 sm:[&_li]:mb-2 [&_strong]:text-white [&_strong]:font-semibold [&_em]:text-white [&_blockquote]:text-white [&_blockquote]:text-sm sm:[&_blockquote]:text-base [&_blockquote]:border-l-4 [&_blockquote]:border-gray-400 [&_blockquote]:pl-3 sm:[&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 sm:[&_blockquote]:my-4 [&_code]:text-white [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs sm:[&_code]:text-sm [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[280px] sm:[&_img]:max-h-[360px] md:[&_img]:max-h-[420px] [&_img]:object-contain [&_img]:rounded-lg [&_img]:my-4 sm:[&_img]:my-6 [&_img]:mx-auto [&_img]:block [&_img]:border-none [&_img]:hover:border-transparent [&_img]:hover:opacity-100 [&_a]:text-purple-400 [&_a]:hover:text-purple-300 [&_a]:underline [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse [&_th]:border [&_th]:border-gray-600 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-gray-600 [&_td]:px-2 [&_td]:py-1"
                dangerouslySetInnerHTML={{ __html: contentWithAltText }}
              />
            </article>
          </div>
        </div>
      </div>
    </>
  );
}
