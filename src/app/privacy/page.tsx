import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy: Primy",
  description: "How Primy collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 10, 2026">
      <p>
        Primy is an AI workspace for documents, spreadsheets, decks, and pages.
        This policy explains what we collect, why, and the controls you have.
        The short version: your content is yours, we do not sell data, and you
        can export or delete everything yourself at any time.
      </p>

      <LegalSection heading="What we collect">
        <p>
          <strong>Account data.</strong> Your email address, optional name, and
          sign-in records (including login attempts, kept for abuse prevention).
        </p>
        <p>
          <strong>Your content.</strong> The workspaces, documents, sheets,
          decks, pages, chat messages, and files you create or upload. This is
          the product; we store it so you can use it.
        </p>
        <p>
          <strong>Usage counters.</strong> Monthly counts of AI messages, file
          uploads, and storage used, to enforce plan limits.
        </p>
        <p>
          <strong>Logs.</strong> Server logs (errors, request metadata) for
          reliability and security. We do not run third-party advertising
          trackers.
        </p>
      </LegalSection>

      <LegalSection heading="How AI processing works">
        <p>
          When you chat with the assistant, your message and relevant workspace
          content are sent to our AI provider (OpenAI) to generate the
          response. We send only what the feature needs. Per OpenAI's API
          policy, API data is not used to train their models.
        </p>
      </LegalSection>

      <LegalSection heading="Where your data lives">
        <p>
          Application data is stored in a managed PostgreSQL database (Neon).
          Uploaded files are stored in Vercel Blob storage. The app is hosted
          on Vercel. Transactional emails (sign-in codes, password resets) are
          sent through Resend.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          We use one essential session cookie to keep you signed in, plus a
          local preference for your theme. No advertising or cross-site
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="Sharing and visibility">
        <p>
          Workspaces are private by default. Content becomes visible to others
          only when you invite them, share it with your team, or create a
          public share link. Anyone with a share link can view that shared
          item; you can revoke a link at any time.
        </p>
      </LegalSection>

      <LegalSection heading="Your controls">
        <p>
          <strong>Export.</strong> Settings → Account → Export my data gives
          you a full JSON export of your profile, workspaces, and content.
        </p>
        <p>
          <strong>Delete.</strong> Settings → Account → Delete account
          permanently removes your account, workspaces, content, and uploaded
          files. This is immediate and irreversible.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          Items you delete in the app go to Trash (recoverable), and are gone
          permanently when you empty them or delete your account. Old version
          snapshots are pruned automatically per your plan's retention.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions or data requests: email{" "}
          <a href="mailto:hello@outlined.studio" className="underline underline-offset-2">
            hello@outlined.studio
          </a>
          . We respond to data requests within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If this policy changes materially we will update this page and the
          date above. Continued use after a change means you accept the
          updated policy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
