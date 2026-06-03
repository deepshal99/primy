import { Resend } from "resend";

// Shared Resend mailer. From-address is configurable; the domain must be
// verified in Resend for delivery. Sends are best-effort at the call site.

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export const MAIL_FROM = process.env.RESEND_FROM_EMAIL || "Primy <noreply@primy.ai>";

/** Send a passwordless login code. Throws on Resend error (caller decides). */
export async function sendLoginCode(to: string, code: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: MAIL_FROM,
    to,
    subject: `${code} is your Primy code`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#FCFBF8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCFBF8;padding:48px 24px;">
          <tr><td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFDFB;border-radius:16px;border:1px solid rgba(24,24,22,0.10);padding:40px;">
              <tr><td>
                <div style="width:36px;height:36px;border-radius:10px;background-color:#1A1815;margin-bottom:24px;"></div>
                <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1A1815;line-height:1.3;">Your sign-in code</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#706E68;line-height:1.6;">
                  Enter this code to sign in to Primy. It expires in 10 minutes.
                </p>
                <div style="font-size:34px;font-weight:600;letter-spacing:8px;color:#1A1815;background-color:#F7F7F4;border-radius:12px;padding:18px 0;text-align:center;">
                  ${code}
                </div>
                <p style="margin:24px 0 0;font-size:12px;color:#B9B6AE;line-height:1.5;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
  if (error) {
    throw new Error(typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error));
  }
}
