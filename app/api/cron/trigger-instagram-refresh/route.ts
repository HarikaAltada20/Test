import { Client } from "@upstash/qstash";

export async function GET() {
  try {
    const client = new Client({
      token: process.env.QSTASH_TOKEN!,
    });

    await client.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/refresh-metrics`,
      body: {},
    });

    return Response.json({ 
      success: true,
      message: "Instagram refresh job triggered via QStash",
      triggered: true 
    });
  } catch (error) {
    console.error("Failed to trigger QStash job:", error);
    return Response.json({ 
      success: false,
      error: "Failed to trigger QStash job" 
    }, { status: 500 });
  }
}
