import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

type BlogStatus = "draft" | "published";

interface CreateBlogRequest {
  title: string;
  excerpt?: string;
  contentHtml: string;
  category?: string;
  thumbnailUrl?: string;
  readTimeMinutes?: number;
  status?: BlogStatus;
  publishedAt?: string | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const adminAccess = await verifyAdminAccess();
    if (!adminAccess.isAdmin) {
      return NextResponse.json(
        { error: adminAccess.error || "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const statusParam = searchParams.get("status") as BlogStatus | null;
    const limit = Number(searchParams.get("limit") || "50");

    const supabase = createAdminClient();

    if (id) {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(
          "id, title, short_description, content, category, thumbnail, read_time_minutes, status, created_at, updated_at, published_at"
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching blog post:", error);
        return NextResponse.json(
          { error: "Failed to fetch blog post" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, post: data });
    }

    let query = supabase
      .from("blog_posts")
      .select(
        "id, title, short_description, category, thumbnail, read_time_minutes, status, created_at, updated_at, published_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusParam) {
      query = query.eq("status", statusParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching blog posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch blog posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, posts: data ?? [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/blogs:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminAccess = await verifyAdminAccess();
    if (!adminAccess.isAdmin) {
      return NextResponse.json(
        { error: adminAccess.error || "Admin access required" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as CreateBlogRequest;
    const {
      title,
      excerpt,
      contentHtml,
      category,
      thumbnailUrl,
      readTimeMinutes,
      status = "draft",
      publishedAt,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Only require content when publishing
    if (status === "published") {
      if (!contentHtml || !contentHtml.trim() || contentHtml === "<p></p>") {
        return NextResponse.json(
          { error: "Content is required to publish" },
          { status: 400 }
        );
      }
    }

    let finalPublishedAt: string | null = null;
    if (status === "published") {
      finalPublishedAt = publishedAt || new Date().toISOString();
    } else if (publishedAt) {
      finalPublishedAt = publishedAt;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: title.trim(),
        short_description: excerpt?.trim() || null,
        content: contentHtml?.trim() || null,
        category: category?.trim() || null,
        thumbnail: thumbnailUrl?.trim() || null,
        read_time_minutes:
          typeof readTimeMinutes === "number" && !isNaN(readTimeMinutes)
            ? readTimeMinutes
            : null,
        status,
        published_at: finalPublishedAt,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique_violation
        return NextResponse.json(
          { error: "Slug already exists. Please choose a different slug." },
          { status: 409 }
        );
      }

      console.error("Error creating blog post:", error);
      return NextResponse.json(
        { error: "Failed to create blog post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, post: data }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in /api/admin/blogs:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminAccess = await verifyAdminAccess();
    if (!adminAccess.isAdmin) {
      return NextResponse.json(
        { error: adminAccess.error || "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    const body = (await req.json()) as {
      id: string;
      status?: BlogStatus;
      title?: string;
      excerpt?: string;
      contentHtml?: string;
      category?: string;
      thumbnailUrl?: string;
      readTimeMinutes?: number;
    };

    const {
      id,
      status,
      title,
      excerpt,
      contentHtml,
      category,
      thumbnailUrl,
      readTimeMinutes,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Blog post id is required" },
        { status: 400 }
      );
    }

    // Fetch current blog post to check existing status and published_at
    const { data: existingPost, error: fetchError } = await supabase
      .from("blog_posts")
      .select("status, published_at")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching existing blog post:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch existing blog post" },
        { status: 500 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      if (!["draft", "published"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      updateData.status = status;
      // Only set published_at if changing from draft to published
      // If already published, preserve the existing published_at timestamp
      if (status === "published" && existingPost?.status !== "published") {
        updateData.published_at = new Date().toISOString();
      }
      // If already published and staying published, don't touch published_at
      // (it will remain unchanged in the database)
    }

    if (title !== undefined) {
      updateData.title = title.trim();
    }

    if (excerpt !== undefined) {
      updateData.short_description = excerpt.trim() || null;
    }

    if (contentHtml !== undefined) {
      updateData.content = contentHtml;
    }

    if (category !== undefined) {
      updateData.category = category.trim() || null;
    }

    if (thumbnailUrl !== undefined) {
      updateData.thumbnail = thumbnailUrl.trim() || null;
    }

    if (readTimeMinutes !== undefined) {
      updateData.read_time_minutes =
        typeof readTimeMinutes === "number" && !isNaN(readTimeMinutes)
          ? readTimeMinutes
          : null;
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating blog post:", error);
      return NextResponse.json(
        { error: "Failed to update blog post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/admin/blogs:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminAccess = await verifyAdminAccess();
    if (!adminAccess.isAdmin) {
      return NextResponse.json(
        { error: adminAccess.error || "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      // Fallback to JSON body if id not in query
      const body = (await req.json().catch(() => null)) as {
        id?: string;
      } | null;
      id = body?.id || null;
    }

    if (!id) {
      return NextResponse.json(
        { error: "Blog post id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);

    if (error) {
      console.error("Error deleting blog post:", error);
      return NextResponse.json(
        { error: "Failed to delete blog post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/admin/blogs:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
