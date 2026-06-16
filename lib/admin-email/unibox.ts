import { createAdminClient } from "@/utils/supabase/admin";
import { htmlToPlainText } from "@/lib/email/admin-bulk-email";
import { normalizeSesMessageId } from "@/lib/email/inbound-email-parse";

export type UniboxFolder = "all" | "sent" | "replies";
export type UniboxReadFilter = "all" | "read" | "unread";

export type UniboxThreadListItem = {
  id: string;
  projectId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  userId: string | null;
  contactEmail: string;
  contactName: string | null;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string;
  replyCount: number;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  latestDirection: "outbound" | "inbound";
  latestFromEmail: string;
  latestFromName: string | null;
};

export type UniboxMessage = {
  id: string;
  threadId: string;
  direction: "outbound" | "inbound";
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  snippet: string | null;
  sesMessageId: string | null;
  inReplyToMessageId: string | null;
  createdAt: string;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string | null;
    sizeBytes: number | null;
  }>;
};

export type UniboxThreadDetail = {
  thread: UniboxThreadListItem;
  messages: UniboxMessage[];
};

function makeSnippet(text: string, maxLen = 200): string {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

async function findThreadBySesReference(
  inReplyToMessageId: string | null | undefined,
): Promise<{
  threadId: string;
  projectId: string | null;
  campaignId: string | null;
  userId: string | null;
} | null> {
  if (!inReplyToMessageId?.trim()) return null;

  const db = createAdminClient();
  const normalized = normalizeSesMessageId(inReplyToMessageId);
  if (!normalized) return null;

  const { data: parentMessage } = await db
    .from("admin_email_unibox_messages")
    .select("thread_id, project_id, campaign_id, user_id, ses_message_id")
    .ilike("ses_message_id", `%${normalized}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (parentMessage?.thread_id) {
    return {
      threadId: parentMessage.thread_id,
      projectId: parentMessage.project_id,
      campaignId: parentMessage.campaign_id,
      userId: parentMessage.user_id,
    };
  }

  const { data: recipient } = await db
    .from("admin_email_campaign_recipients")
    .select("campaign_id, user_id")
    .ilike("ses_message_id", `%${normalized}%`)
    .limit(1)
    .maybeSingle();

  if (recipient?.campaign_id && recipient.user_id) {
    const { data: campaign } = await db
      .from("admin_email_campaigns")
      .select("project_id")
      .eq("id", recipient.campaign_id)
      .maybeSingle();

    const projectId = campaign?.project_id ?? null;

    const { data: thread } = await db
      .from("admin_email_unibox_threads")
      .select("id, project_id, campaign_id, user_id")
      .eq("campaign_id", recipient.campaign_id)
      .eq("user_id", recipient.user_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (thread) {
      return {
        threadId: thread.id,
        projectId: thread.project_id ?? projectId,
        campaignId: thread.campaign_id ?? recipient.campaign_id,
        userId: thread.user_id ?? recipient.user_id,
      };
    }

    const { data: user } = await db
      .from("users")
      .select("email, full_name, username")
      .eq("id", recipient.user_id)
      .maybeSingle();

    if (user?.email) {
      const { data: created } = await db
        .from("admin_email_unibox_threads")
        .insert({
          project_id: projectId,
          campaign_id: recipient.campaign_id,
          user_id: recipient.user_id,
          contact_email: user.email.toLowerCase(),
          contact_name: user.full_name ?? user.username,
          is_read: false,
        })
        .select("id, project_id, campaign_id, user_id")
        .single();

      if (created) {
        return {
          threadId: created.id,
          projectId: created.project_id,
          campaignId: created.campaign_id,
          userId: created.user_id,
        };
      }
    }
  }

  return null;
}

async function findThreadByContactEmail(
  fromEmail: string,
): Promise<{
  threadId: string;
  projectId: string | null;
  campaignId: string | null;
  userId: string | null;
  replyCount: number;
} | null> {
  const db = createAdminClient();

  const { data: thread } = await db
    .from("admin_email_unibox_threads")
    .select("id, project_id, campaign_id, user_id, reply_count")
    .eq("contact_email", fromEmail)
    .eq("is_deleted", false)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (thread) {
    return {
      threadId: thread.id,
      projectId: thread.project_id,
      campaignId: thread.campaign_id,
      userId: thread.user_id,
      replyCount: thread.reply_count ?? 0,
    };
  }

  const { data: user } = await db
    .from("users")
    .select("id, email, full_name, username")
    .ilike("email", fromEmail)
    .maybeSingle();

  if (!user?.id) return null;

  const { data: threadByUser } = await db
    .from("admin_email_unibox_threads")
    .select("id, project_id, campaign_id, user_id, reply_count")
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!threadByUser) return null;

  return {
    threadId: threadByUser.id,
    projectId: threadByUser.project_id,
    campaignId: threadByUser.campaign_id,
    userId: threadByUser.user_id,
    replyCount: threadByUser.reply_count ?? 0,
  };
}

export async function logOutboundUniboxMessage(input: {
  projectId: string;
  campaignId: string;
  userId: string;
  contactEmail: string;
  contactName?: string | null;
  fromEmail: string;
  fromName?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  sesMessageId?: string;
}): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const contactEmail = input.contactEmail.toLowerCase().trim();
  const bodyText = input.bodyText?.trim() || htmlToPlainText(input.bodyHtml);
  const snippet = makeSnippet(bodyText);

  const { data: existingThread } = await db
    .from("admin_email_unibox_threads")
    .select("id, reply_count")
    .eq("campaign_id", input.campaignId)
    .eq("user_id", input.userId)
    .eq("is_deleted", false)
    .maybeSingle();

  let threadId = existingThread?.id as string | undefined;

  if (!threadId) {
    const { data: createdThread, error: threadError } = await db
      .from("admin_email_unibox_threads")
      .insert({
        project_id: input.projectId,
        campaign_id: input.campaignId,
        user_id: input.userId,
        contact_email: contactEmail,
        contact_name: input.contactName ?? null,
        subject: input.subject,
        last_message_at: now,
        latest_snippet: snippet,
        latest_direction: "outbound",
        reply_count: existingThread?.reply_count ?? 0,
        is_read: true,
        updated_at: now,
      })
      .select("id")
      .single();

    if (threadError || !createdThread) {
      console.error("[unibox] failed to create thread:", threadError?.message);
      return;
    }
    threadId = createdThread.id;
  } else {
    await db
      .from("admin_email_unibox_threads")
      .update({
        subject: input.subject,
        last_message_at: now,
        latest_snippet: snippet,
        latest_direction: "outbound",
        updated_at: now,
      })
      .eq("id", threadId);
  }

  const { error: messageError } = await db.from("admin_email_unibox_messages").insert({
    thread_id: threadId,
    direction: "outbound",
    project_id: input.projectId,
    campaign_id: input.campaignId,
    user_id: input.userId,
    from_email: input.fromEmail,
    from_name: input.fromName ?? null,
    to_email: contactEmail,
    to_name: input.contactName ?? null,
    subject: input.subject,
    body_text: bodyText,
    body_html: input.bodyHtml,
    snippet,
    ses_message_id: input.sesMessageId ?? null,
    created_at: now,
  });

  if (messageError) {
    console.error("[unibox] failed to log outbound message:", messageError.message);
  }
}

export async function ingestInboundUniboxMessage(input: {
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  sesMessageId?: string | null;
  inReplyToMessageId?: string | null;
  stopOnReply?: boolean;
  attachments?: Array<{
    filename: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    storagePath?: string | null;
  }>;
}): Promise<{ threadId?: string; messageId?: string }> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const fromEmail = input.fromEmail.toLowerCase().trim();
  const bodyText =
    input.bodyText?.trim() ||
    (input.bodyHtml ? htmlToPlainText(input.bodyHtml) : "");
  const snippet = makeSnippet(bodyText);

  if (input.sesMessageId) {
    const normalizedInbound = normalizeSesMessageId(input.sesMessageId);
    if (normalizedInbound) {
      const { data: duplicate } = await db
        .from("admin_email_unibox_messages")
        .select("id, thread_id")
        .eq("direction", "inbound")
        .ilike("ses_message_id", `%${normalizedInbound}%`)
        .maybeSingle();
      if (duplicate) {
        return { threadId: duplicate.thread_id, messageId: duplicate.id };
      }
    }
  }

  let threadId: string | undefined;
  let projectId: string | null = null;
  let campaignId: string | null = null;
  let userId: string | null = null;
  let existingReplyCount = 0;

  const byReference = await findThreadBySesReference(input.inReplyToMessageId);
  if (byReference) {
    threadId = byReference.threadId;
    projectId = byReference.projectId;
    campaignId = byReference.campaignId;
    userId = byReference.userId;
  }

  if (!threadId) {
    const byContact = await findThreadByContactEmail(fromEmail);
    if (byContact) {
      threadId = byContact.threadId;
      projectId = byContact.projectId;
      campaignId = byContact.campaignId;
      userId = byContact.userId;
      existingReplyCount = byContact.replyCount;
    }
  }

  if (threadId && existingReplyCount === 0) {
    const { data: thread } = await createAdminClient()
      .from("admin_email_unibox_threads")
      .select("reply_count")
      .eq("id", threadId)
      .maybeSingle();
    existingReplyCount = thread?.reply_count ?? 0;
  }

  if (!threadId) {
    const { data: createdThread, error } = await db
      .from("admin_email_unibox_threads")
      .insert({
        project_id: projectId,
        campaign_id: campaignId,
        user_id: userId,
        contact_email: fromEmail,
        contact_name: input.fromName ?? null,
        subject: input.subject,
        last_message_at: now,
        latest_snippet: snippet,
        latest_direction: "inbound",
        reply_count: 1,
        is_read: false,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !createdThread) {
      console.error("[unibox] inbound thread create failed:", error?.message);
      return {};
    }
    threadId = createdThread.id;
  } else {
    await db
      .from("admin_email_unibox_threads")
      .update({
        subject: input.subject,
        last_message_at: now,
        latest_snippet: snippet,
        latest_direction: "inbound",
        reply_count: existingReplyCount + 1,
        is_read: false,
        updated_at: now,
      })
      .eq("id", threadId);

    if (input.stopOnReply && campaignId && userId) {
      const { data: campaign } = await db
        .from("admin_email_campaigns")
        .select("stop_on_reply")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaign?.stop_on_reply) {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "skipped",
            skipped_reason: "replied",
            next_email_scheduled_at: null,
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", userId)
          .in("email_delivery_status", ["pending", "in_sequence"]);
      }
    }
  }

  const { data: message, error: messageError } = await db
    .from("admin_email_unibox_messages")
    .insert({
      thread_id: threadId,
      direction: "inbound",
      project_id: projectId,
      campaign_id: campaignId,
      user_id: userId,
      from_email: fromEmail,
      from_name: input.fromName ?? null,
      to_email: input.toEmail.toLowerCase().trim(),
      to_name: null,
      subject: input.subject,
      body_text: bodyText,
      body_html: input.bodyHtml ?? null,
      snippet,
      ses_message_id: input.sesMessageId ?? null,
      in_reply_to_message_id: input.inReplyToMessageId ?? null,
      created_at: now,
    })
    .select("id")
    .single();

  if (messageError || !message) {
    console.error("[unibox] inbound message insert failed:", messageError?.message);
    return { threadId };
  }

  if (input.attachments?.length) {
    await db.from("admin_email_unibox_attachments").insert(
      input.attachments.map((a) => ({
        message_id: message.id,
        filename: a.filename,
        content_type: a.contentType ?? null,
        size_bytes: a.sizeBytes ?? null,
        storage_path: a.storagePath ?? null,
      })),
    );
  }

  return { threadId, messageId: message.id };
}

export async function listUniboxThreads(params: {
  folder?: UniboxFolder;
  readFilter?: UniboxReadFilter;
  campaignId?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ threads: UniboxThreadListItem[]; total: number }> {
  const db = createAdminClient();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = db
    .from("admin_email_unibox_threads")
    .select(
      `
      id,
      project_id,
      campaign_id,
      user_id,
      contact_email,
      contact_name,
      subject,
      last_message_at,
      reply_count,
      is_read,
      is_starred,
      is_archived,
      latest_snippet,
      latest_direction,
      admin_email_campaigns ( name )
    `,
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.folder === "sent") {
    query = query.eq("reply_count", 0).neq("latest_direction", "inbound");
  } else if (params.folder === "replies") {
    query = query.or("reply_count.gt.0,latest_direction.eq.inbound");
  }

  if (params.readFilter === "read") {
    query = query.eq("is_read", true);
  } else if (params.readFilter === "unread") {
    query = query.eq("is_read", false);
  }

  if (params.campaignId) {
    query = query.eq("campaign_id", params.campaignId);
  }

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(
      `subject.ilike.${term},contact_email.ilike.${term},contact_name.ilike.${term}`,
    );
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const threads: UniboxThreadListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    campaignId: row.campaign_id,
    campaignName:
      (row.admin_email_campaigns as { name?: string } | null)?.name ?? null,
    userId: row.user_id,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    subject: row.subject,
    snippet: row.latest_snippet ?? null,
    lastMessageAt: row.last_message_at,
    replyCount: row.reply_count ?? 0,
    isRead: row.is_read,
    isStarred: row.is_starred,
    isArchived: row.is_archived,
    latestDirection:
      row.latest_direction === "inbound" ? "inbound" : "outbound",
    latestFromEmail: row.contact_email,
    latestFromName: row.contact_name,
  }));

  return { threads, total: count ?? threads.length };
}

export async function getUniboxThreadDetail(
  threadId: string,
): Promise<UniboxThreadDetail | null> {
  const db = createAdminClient();

  const { data: row, error } = await db
    .from("admin_email_unibox_threads")
    .select(
      `
      id,
      project_id,
      campaign_id,
      user_id,
      contact_email,
      contact_name,
      subject,
      last_message_at,
      reply_count,
      is_read,
      is_starred,
      is_archived,
      admin_email_campaigns ( name ),
      admin_email_unibox_messages (
        id,
        thread_id,
        direction,
        from_email,
        from_name,
        to_email,
        to_name,
        subject,
        body_text,
        body_html,
        snippet,
        ses_message_id,
        in_reply_to_message_id,
        created_at,
        is_deleted,
        admin_email_unibox_attachments (
          id,
          filename,
          content_type,
          size_bytes
        )
      )
    `,
    )
    .eq("id", threadId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error || !row) return null;

  const messages = ((row.admin_email_unibox_messages ?? []) as Array<{
    id: string;
    thread_id: string;
    direction: "outbound" | "inbound";
    from_email: string;
    from_name: string | null;
    to_email: string;
    to_name: string | null;
    subject: string;
    body_text: string | null;
    body_html: string | null;
    snippet: string | null;
    ses_message_id: string | null;
    in_reply_to_message_id: string | null;
    created_at: string;
    is_deleted: boolean;
    admin_email_unibox_attachments?: Array<{
      id: string;
      filename: string;
      content_type: string | null;
      size_bytes: number | null;
    }>;
  }>)
    .filter((m) => !m.is_deleted)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const latest = messages[messages.length - 1];

  const thread: UniboxThreadListItem = {
    id: row.id,
    projectId: row.project_id,
    campaignId: row.campaign_id,
    campaignName:
      (row.admin_email_campaigns as { name?: string } | null)?.name ?? null,
    userId: row.user_id,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    subject: row.subject,
    snippet: latest?.snippet ?? null,
    lastMessageAt: row.last_message_at,
    replyCount: row.reply_count ?? 0,
    isRead: row.is_read,
    isStarred: row.is_starred,
    isArchived: row.is_archived,
    latestDirection: latest?.direction ?? "outbound",
    latestFromEmail: latest?.from_email ?? row.contact_email,
    latestFromName: latest?.from_name ?? row.contact_name,
  };

  return {
    thread,
    messages: messages.map((m) => ({
      id: m.id,
      threadId: m.thread_id,
      direction: m.direction,
      fromEmail: m.from_email,
      fromName: m.from_name,
      toEmail: m.to_email,
      toName: m.to_name,
      subject: m.subject,
      bodyText: m.body_text,
      bodyHtml: m.body_html,
      snippet: m.snippet,
      sesMessageId: m.ses_message_id,
      inReplyToMessageId: m.in_reply_to_message_id,
      createdAt: m.created_at,
      attachments: (m.admin_email_unibox_attachments ?? []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        sizeBytes: a.size_bytes,
      })),
    })),
  };
}

export async function getUniboxUnreadCount(): Promise<number> {
  const db = createAdminClient();
  const { count } = await db
    .from("admin_email_unibox_threads")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("is_archived", false)
    .eq("is_read", false);
  return count ?? 0;
}
