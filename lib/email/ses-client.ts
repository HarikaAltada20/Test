import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { buildMimeMessage } from "@/lib/email/mime-message";
import { htmlToPlainText } from "@/lib/email/admin-bulk-email";

let sesClient: SESClient | null = null;

export function getSesClient(): SESClient | null {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!sesClient) {
    sesClient = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return sesClient;
}

export function isSesConfigured(): boolean {
  return !!getSesClient();
}

function formatSesSource(email: string, name?: string): string {
  const trimmed = email.trim();
  if (!name?.trim()) return trimmed;
  const safeName = name.trim().replace(/"/g, '\\"');
  return `"${safeName}" <${trimmed}>`;
}

function configurationSetName(): string | undefined {
  const name = process.env.SES_CONFIGURATION_SET?.trim();
  return name || undefined;
}

export async function sendSesEmail(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  listUnsubscribeUrl?: string;
  plainTextOnly?: boolean;
  useRaw?: boolean;
}): Promise<{
  messageId?: string;
  sesMessageId?: string;
  error?: string;
}> {
  const client = getSesClient();
  if (!client) {
    return { error: "AWS SES is not configured" };
  }

  const text = input.text?.trim() || htmlToPlainText(input.html);
  const html = input.html?.trim() || text.replace(/\n/g, "<br>");
  const configSet = configurationSetName();

  if (input.listUnsubscribeUrl?.trim() || input.inReplyTo?.trim() || input.useRaw) {
    try {
      const mime = buildMimeMessage({
        from: input.from,
        fromName: input.fromName,
        to: input.to,
        subject: input.subject,
        html,
        text,
        replyTo: input.replyTo,
        inReplyTo: input.inReplyTo,
        references: input.references,
        listUnsubscribeUrl: input.listUnsubscribeUrl,
        plainTextOnly: input.plainTextOnly,
      });
      const result = await client.send(
        new SendRawEmailCommand({
          Source: input.from.trim(),
          Destinations: [input.to.trim()],
          RawMessage: { Data: Buffer.from(mime.raw, "utf-8") },
          ...(configSet ? { ConfigurationSetName: configSet } : {}),
        }),
      );
      return {
        messageId: mime.messageId,
        sesMessageId: result.MessageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ses-client] raw send failed:", message);
      return { error: message };
    }
  }

  const params: SendEmailCommandInput = {
    Source: formatSesSource(input.from, input.fromName),
    Destination: { ToAddresses: [input.to.trim()] },
    Message: {
      Subject: { Data: input.subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: text, Charset: "UTF-8" },
        Html: { Data: html, Charset: "UTF-8" },
      },
    },
    ...(input.replyTo?.trim()
      ? { ReplyToAddresses: [input.replyTo.trim()] }
      : {}),
    ...(configSet ? { ConfigurationSetName: configSet } : {}),
  };

  try {
    const result = await client.send(new SendEmailCommand(params));
    return { messageId: result.MessageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ses-client] send failed:", message);
    return { error: message };
  }
}
