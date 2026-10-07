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
        : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}

/** Module-scoped wrapper so the cache is shared across sitemap invocations. */
const getCachedBlogSitemapPosts = unstable_cache(
  async () => {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (!base) return [];
    return fetchBlogPostsForSitemap(base);
  },
  ["sitemap-blog-posts-v1", process.env.NEXT_PUBLIC_APP_URL ?? ""],
  { revalidate: 3600, tags: ["sitemap-blog"] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/brands`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${siteUrl}/creators`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/auth/signin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/auth/forgot-password`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/instagram-connection-faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  let blogPosts: MetadataRoute.Sitemap = [];
  try {
    blogPosts = await getCachedBlogSitemapPosts();
  } catch (error) {
    console.error("Error fetching blog posts for sitemap:", error);
  }

  return [...staticPages, ...blogPosts];
}
