import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { TableOfContents } from "@/components/TableOfContents";
import CtcBanner from "@/components/CtcBanner";
import type { Metadata } from "next";

// Always fetch fresh data so newly published blogs are visible immediately
export const revalidate = 0;

interface BlogPageProps {
  params: Promise<{ id: string }>;
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
      <div className="min-h-screen bg-black text-white">
        {/* Header Section */}
        <section className="w-full px-6 sm:px-12 md:px-[54px] py-14 sm:py-16 md:py-[74px] bg-black overflow-hidden flex flex-col justify-center items-center gap-12 md:gap-[68px]">
          <div className="w-full flex flex-col justify-center items-center gap-6 max-w-[800px]">
            {/* Back Arrow Link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[#C4C4C4] hover:text-white transition-colors group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#C4C4C4] group-hover:text-white group-hover:-translate-x-1 transition-all" />
              <span className="text-[15px] font-normal leading-[21px] font-['Inter']">
                Back to blogs
              </span>
            </Link>

            {/* Title & Description & Meta */}
            <div className="flex flex-col justify-start items-center gap-4 text-center w-full">
              <h1
                id="title"
                className="w-full max-w-[720px] text-center text-white text-2xl sm:text-3xl md:text-[38px] font-bold leading-snug md:leading-[44.8px] font-['Inter'] scroll-mt-20"
              >
                {post.title}
              </h1>

              {post.short_description && (
                <p className="w-full max-w-[654px] text-center text-[#8E8E8E] text-[15px] font-normal leading-[21px] font-['Inter']">
                  {stripHtml(post.short_description)}
                </p>
              )}

              <div className="text-center text-[#8E8E8E] text-[15px] font-normal leading-[21px] font-['Inter']">
                {formatDate(post.published_at || post.created_at)}
                {post.read_time_minutes ? ` - ${post.read_time_minutes} min Read` : ""}
              </div>
            </div>
          </div>
        </section>

        {/* Article Body Section */}
        <section className="w-full bg-black py-10 md:pb-[90px] px-4 sm:px-6 md:px-12 flex justify-center items-center">
          <div className="w-full max-w-[1240px] mx-auto flex flex-col justify-center items-center">
            {/* Table of Contents - Sidebar on Desktop (Commented out) */}
            {/* {tocItems.length > 1 && (
              <aside className="hidden lg:block w-[280px] shrink-0 sticky top-24">
                <TableOfContents
                  items={tocItems}
                  articleUrl={articleUrl}
                  title={post.title}
                />
              </aside>
            )} */}

            {/* Main Article Container Card */}
            <article className="w-full max-w-[1040px] mx-auto bg-[#131313] rounded-[28px] sm:rounded-[41px] p-5 sm:p-[28px_28px_56px_28px] md:p-[32px_36px_68px_36px] overflow-hidden flex flex-col items-center gap-[44px]">
              {/* Featured Image */}
              {post.thumbnail && (
                <div className="w-full max-w-[980px] h-auto max-h-[540px] rounded-[18px] sm:rounded-[23px] overflow-hidden bg-neutral-900 border border-white/5 shrink-0">
                  <img
                    src={post.thumbnail}
                    alt={post.title}
                    className="w-full h-full object-cover max-h-[540px]"
                  />
                </div>
              )}

              {/* Dynamic HTML Content */}
              <div
                className="w-full max-w-[980px] px-1 sm:px-4 flex flex-col gap-6 text-[#C4C4C4] font-['Inter'] font-medium text-base sm:text-lg leading-[26px] sm:leading-[28px] [&_h1]:text-[#F1F1F1] [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-snug [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:font-['Inter'] [&_h1]:scroll-mt-24 [&_h2]:text-[#F1F1F1] [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:font-['Inter'] [&_h2]:scroll-mt-24 [&_h3]:text-[#F1F1F1] [&_h3]:text-lg sm:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:font-['Inter'] [&_h3]:scroll-mt-24 [&_p]:text-[#C4C4C4] [&_p]:text-base sm:[&_p]:text-lg [&_p]:font-medium [&_p]:leading-[26px] sm:[&_p]:leading-[28px] [&_p]:mb-4 [&_p]:font-['Inter'] [&_ul]:text-[#C4C4C4] [&_ul]:text-base sm:[&_ul]:text-lg [&_ul]:font-medium [&_ul]:leading-[26px] sm:[&_ul]:leading-[28px] [&_ul]:mb-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ol]:text-[#C4C4C4] [&_ol]:text-base sm:[&_ol]:text-lg [&_ol]:font-medium [&_ol]:leading-[26px] sm:[&_ol]:leading-[28px] [&_ol]:mb-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_li]:mb-2 [&_strong]:text-[#F1F1F1] [&_strong]:font-semibold [&_a]:text-[#C4A3FF] [&_a]:underline [&_a]:hover:text-white [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[500px] [&_img]:object-contain [&_img]:rounded-[16px] [&_img]:my-6 [&_img]:mx-auto [&_img]:block"
                dangerouslySetInnerHTML={{ __html: contentWithAltText }}
              />
            </article>
          </div>
        </section>

<section className="pt-16 px-4 sm:px-8 lg:px-24 bg-black flex justify-center items-center">
                      <div className="relative w-full max-w-[1200px] min-h-[471px] py-16 px-6 sm:px-12 flex flex-col justify-center items-center overflow-hidden rounded-[28px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)]">
                        {/* Background Decorative Shapes */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[335px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-202px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                          {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[354px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-183px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[308px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-230px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[27px] top-[288px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                          <div className="w-[990px] h-[441px] absolute left-[267px] top-[-250px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                        </div>
              
                        {/* Main Content Box */}
                        <div className="relative z-10 max-w-[654px] mx-auto flex flex-col items-center text-center gap-9">
                          <div className="flex flex-col items-center gap-4">
                            <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium text-white leading-[130%] tracking-tight">
                        Want to promote your brand?
                        <br/>
                        Book a Call
                      </h2>
                            <p className="text-[15px] sm:text-[17px] font-medium text-[#8E8E8E] leading-[150%]">
                              Book a demo with{" "}
                              <span className="text-[#F1F1F1] font-semibold">Vishesh</span>
                              , Founder of Game Of Creators. Join hundreds of successful businesses. Get answers and start launching impactful campaigns with a free consultation.
                            </p>
                          </div>
              
                          <a
                            href="https://calendly.com/guptavishesh2/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2.5 px-9 py-3 bg-[#DEDEDE] text-[#353535] hover:bg-white rounded-[14px] font-semibold text-base leading-[20px] transition-all duration-200 cursor-pointer shadow-md group"
                          >
                            <span>Book Call Now</span>
                            <ArrowRight className="w-4 h-4 text-[#353535] transition-transform group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    </section>
        <CtcBanner />
      </div>
    </>
  );
}
