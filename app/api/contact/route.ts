import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface ContactRequestBody {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const body = (await req.json()) as ContactRequestBody;
    const { name, email, phone, message } = body;

    // 1. Save in Supabase
    const { data: insertedData, error: dbError } = await supabase
      .from("contacts")
      .insert([{ name, email, phone, message }])
      .select();

    if (dbError) {
      console.error("❌ Supabase insert error:", dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    // 2. Send email using Resend
    let emailData;
    try {
      emailData = await resend.emails.send({
        from: "onboarding@resend.dev", // ✅ use this only for sandbox mode
        to: "altadahari7799@gmail.com", // ✅ must be the same email as Resend account in sandbox
        subject: `⚡Game of Creators | Support Request from - ${name}`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>New Inquiry</title>
          </head>
          <body style="margin:0; padding:30px 0; font-family: Arial, sans-serif; background-color:#000825;">
            <table align="center" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
           
        
              <!-- Banner -->
              <tr>
                <td style="background:#4B0082; color:#fff; text-align:center; padding:40px 20px;">
                    <img src="https://drive.usercontent.google.com/u/0/uc?id=1IiPr58q6S9Y7M7fNZuHWis8rVYSqYlM2&export=download" alt="Game of Creators" width="180" style="display:block; margin:auto;" />
                  <h2 style="margin:5px 0 0; font-size:26px;">New Support Request</h2>
                  <p style="margin:5px 0 0; font-size:16px; font-weight:500;">You have a new inquiry from your website</p>
                </td>
              </tr>
        
              <!-- Body -->
              <tr>
                <td style="padding:30px 40px; color:#444; font-size:15px; line-height:1.6;">
                  <p style="margin-bottom:25px; text-align:center; color:#777;">
                    Here is the inquiry that you have received from the <a href="#" style="color:#00A79D; text-decoration:none;">Contact Us</a> page.
                  </p>
        
                  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-size:14px;">
                    <tr>
                      <td style="width:100px; font-weight:bold; color:#333;">Name:</td>
                      <td>${name}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold; color:#333;">Email:</td>
                      <td>${email}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold; color:#333;">Phone:</td>
                      <td>${phone ?? "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold; color:#333;">Message:</td>
                      <td style="white-space:pre-line; color:#555;">${message}</td>
                    </tr>
                  </table>
                </td>
              </tr>
        
              <!-- Footer -->
              <tr>
                <td style="background:#4B0082; text-align:center; padding:15px; color:#fff; font-size:13px;">
                 © 2025 Game Of Creators. All rights reserved.
                </td>
              </tr>
            </table>
          </body>
        </html>
        `,
        
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone ?? "N/A"}\nMessage: ${message}`,
      });

      console.log("✅ Resend response:", emailData);
    } catch (err) {
      console.error("❌ Resend send error:", err);
      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dbData: insertedData,
      emailData,
    });
  } catch (error: unknown) {
    console.error("❌ Contact API error:", error);

    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
