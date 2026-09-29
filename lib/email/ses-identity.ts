import {
  GetIdentityVerificationAttributesCommand,
  VerifyDomainDkimCommand,
  VerifyDomainIdentityCommand,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";
import { getSesClient } from "./ses-client";

export type DnsRecord = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

export function buildFullDomain(
  rootDomain: string,
  subdomainPrefix: string,
): string {
  const root = rootDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  const prefix = subdomainPrefix.trim().toLowerCase().replace(/\.$/, "");
  if (!root) return "";
  if (!prefix) return root;
  return `${prefix}.${root}`;
}

export async function verifyDomainWithSes(fullDomain: string): Promise<{
  dnsRecords: DnsRecord[];
  error?: string;
}> {
  const client = getSesClient();
  if (!client) {
    return { dnsRecords: [], error: "AWS SES is not configured" };
  }

  try {
    await client.send(
      new VerifyDomainIdentityCommand({ Domain: fullDomain }),
    );
    const dkim = await client.send(
      new VerifyDomainDkimCommand({ Domain: fullDomain }),
    );

    const dnsRecords: DnsRecord[] = [
      {
        type: "TXT",
        name: `_amazonses.${fullDomain}`,
        value: "(verification token from SES console)",
        purpose: "Domain verification",
      },
      ...(dkim.DkimTokens ?? []).map((token) => ({
        type: "CNAME",
        name: `${token}._domainkey.${fullDomain}`,
        value: `${token}.dkim.amazonses.com`,
        purpose: "DKIM",
      })),
      {
        type: "TXT",
        name: fullDomain,
        value: "v=spf1 include:amazonses.com ~all",
        purpose: "SPF",
      },
      {
        type: "TXT",
        name: `_dmarc.${fullDomain}`,
        value: "v=DMARC1; p=none; rua=mailto:dmarc@" + fullDomain,
        purpose: "DMARC",
      },
    ];

    return { dnsRecords };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { dnsRecords: [], error: message };
  }
}

export async function verifySenderEmailWithSes(
  email: string,
): Promise<{ error?: string }> {
  const client = getSesClient();
  if (!client) {
    return { error: "AWS SES is not configured" };
  }

  try {
    await client.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

export async function checkSesVerificationStatus(identities: string[]): Promise<
  Record<string, "pending" | "verified" | "failed">
> {
  const client = getSesClient();
  const result: Record<string, "pending" | "verified" | "failed"> = {};
  if (!client || identities.length === 0) return result;

  try {
    const response = await client.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: identities,
      }),
    );
    for (const identity of identities) {
      const attrs = response.VerificationAttributes?.[identity];
      if (attrs?.VerificationStatus === "Success") {
        result[identity] = "verified";
      } else if (attrs?.VerificationStatus === "Failed") {
        result[identity] = "failed";
      } else {
        result[identity] = "pending";
      }
    }
  } catch (err) {
    console.error("[ses-identity] check status failed:", err);
  }

  return result;
}
