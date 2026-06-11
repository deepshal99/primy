import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service: Primy",
  description: "The terms that govern your use of Primy.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 10, 2026">
      <p>
        These terms govern your use of Primy. By creating an account or using
        the service you agree to them.
      </p>

      <LegalSection heading="The service">
        <p>
          Primy is an AI workspace: you chat to create and edit documents,
          spreadsheets, decks, and pages. AI output can be wrong, incomplete,
          or unsuitable for your purpose; review it before you rely on it or
          ship it to a client.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          Keep your sign-in email secure; anyone who controls it can access
          your account. You are responsible for activity under your account.
          You must be at least 16 to use Primy.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You own what you create and upload. You grant us only the rights
          needed to operate the service: storing your content, processing it
          with our AI provider to fulfil your requests, and displaying it to
          people you share it with. We claim no other rights.
        </p>
        <p>
          Do not upload content that is illegal, infringes others' rights, or
          contains malware. Do not use Primy to generate spam, malware, or
          deceptive material.
        </p>
      </LegalSection>

      <LegalSection heading="Plans and billing">
        <p>
          The Free plan has monthly limits (AI messages, uploads, storage).
          Pro is a paid subscription billed monthly; limits are listed on the
          pricing page. We may adjust limits with notice. Refunds: full refund
          within 7 days of any charge, no questions asked.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          No abuse of the service: no attempts to break authentication or
          access others' data, no resource abuse (automated bulk requests,
          scraping the AI endpoints), no reselling access without an
          agreement with us. We may suspend accounts that threaten the
          service or other users, and will tell you why.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and warranty">
        <p>
          Primy is provided as-is, in active development. We work to keep it
          fast and reliable but do not guarantee uninterrupted availability.
          To the extent permitted by law, we disclaim implied warranties, and
          our total liability for any claim is limited to the amount you paid
          us in the 12 months before the claim.
        </p>
      </LegalSection>

      <LegalSection heading="Ending the relationship">
        <p>
          You can delete your account at any time (Settings → Account), which
          permanently removes your data. We may terminate accounts that
          violate these terms. On termination your right to use the service
          ends; export your data first.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          We may update these terms; material changes will be reflected on
          this page with a new date. Questions:{" "}
          <a href="mailto:hello@outlined.studio" className="underline underline-offset-2">
            hello@outlined.studio
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
