import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";

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

export async function sendSesEmail(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId?: string; error?: string }> {
  const client = getSesClient();
  if (!client) {
    return { error: "AWS SES is not configured" };
  }

  const params: SendEmailCommandInput = {
    Source: input.from,
    Destination: { ToAddresses: [input.to] },
    Message: {
      Subject: { Data: input.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: input.html, Charset: "UTF-8" },
        ...(input.text
          ? { Text: { Data: input.text, Charset: "UTF-8" } }
          : {}),
      },
    },
    ...(process.env.SES_CONFIGURATION_SET?.trim()
      ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET.trim() }
      : {}),
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
