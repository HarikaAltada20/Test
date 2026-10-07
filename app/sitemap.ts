import { SEO_ORIGIN } from "@/lib/seo/metadata";
import pages from "@/lib/seo/pages.json";
import { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { createPublicServerClient } from "@/utils/supabase/public-server";

/** Built at request time so `next build` never blocks 60s+ on DB pool contention. */
export const dynamic = "force-dynamic";

async function fetchBlogPostsForSitemap(siteUrl: string): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicServerClient();
  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, published_at, updated_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error || !posts) return [];

  return posts.map((post) => ({
    url: `${siteUrl}/blog/${post.id}`,
    lastModified: post.updated_at
      ? new Date(post.updated_at)
      : post.published_at
        ? new Date(post.published_at)
        : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}

/** Module-scoped wrapper so the cache is shared across sitemap invocations. */
const getCachedBlogSitemapPosts = unstable_cache(
  async () => {
    const base = SEO_ORIGIN;
    if (!base) return [];
    return fetchBlogPostsForSitemap(base);
  },
  ["sitemap-blog-posts-v1", SEO_ORIGIN ?? ""],
  { revalidate: 3600, tags: ["sitemap-blog"] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = SEO_ORIGIN;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }

  // Real reviewed public pages; utility/redirect paths and invented dates are excluded.
  const staticPages:MetadataRoute.Sitemap=pages.map(page=>({url:page.canonical}));

  let blogPosts: MetadataRoute.Sitemap = [];
  try {
    blogPosts = await getCachedBlogSitemapPosts();
  } catch (error) {
    console.error("Error fetching blog posts for sitemap:", error);
  }

  return [...staticPages, ...blogPosts];
}
