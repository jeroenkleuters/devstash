import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · CodeSquirrel",
  description:
    "What CodeSquirrel stores, what the AI features send to OpenAI, and how to turn them off.",
};

/**
 * What the app stores and what it sends where.
 *
 * A server component with no state and no effects, inside `(marketing)` so it
 * inherits that group's nav and footer. **Public on purpose** — `/privacy` is
 * deliberately absent from the proxy matcher, because someone deciding whether
 * to sign up has to be able to read it.
 *
 * Plain prose in the app's own type styles rather than marketing chrome: it is
 * a disclosure, and it should read like one.
 *
 * The copy is the draft at `context/features/privacy-page-content.md`, which
 * was written against the code rather than from a template. Two things there
 * are still open, both deferred deliberately while the app has no real users:
 * the OpenAI retention paragraph in §2 needs checking against their current
 * data-usage terms — it is the one claim here describing someone else's policy,
 * and the one that dates — and a rights section is not something to ship from
 * an AI-assisted draft unreviewed, GDPR applying once there are EU users.
 */
export default function PrivacyPage() {
  return (
    <article className="legal">
      <header className="legal-header">
        <h1>Privacy Policy</h1>
        <p className="legal-lede">
          What CodeSquirrel stores, who else touches it, and what the AI features
          send. Written to be read rather than to be comprehensive — if
          anything here is unclear, ask.
        </p>
      </header>

      <section className="legal-section">
        <h2>1. What we store</h2>

        <p>
          <strong>Your account.</strong> Your email address and display name.
          If you sign up with a password we store a bcrypt hash of it and
          never the password itself. If you sign in with GitHub instead, we
          store what GitHub gives us: your name, email, avatar URL and the
          tokens that keep the connection working.
        </p>

        <p>
          <strong>What you save.</strong> The items you create — their titles,
          descriptions, content, links, tags and language hints — and the
          collections you organise them into.
        </p>

        <p>
          <strong>Files you upload.</strong> Files, images and book covers are
          stored in Cloudflare R2. They are served back to you through
          CodeSquirrel rather than from a public URL, so a file is reachable only
          by the account that owns it.
        </p>

        <p>
          <strong>Technical data.</strong> Your IP address is read from the
          request when you sign in, register, reset a password or upload a
          file, and is counted against a short rate-limit window to stop
          abuse. Those counters live in Upstash Redis and expire within hours.
          We do <strong>not</strong> run analytics: no page-view tracking, no
          session recording, no advertising or third-party trackers, and no
          record of which features you click.
        </p>

        <p>
          <strong>Cookies.</strong> One session cookie, so you stay signed in.
          It is not used for tracking, and there are no advertising cookies.
        </p>
      </section>

      <section className="legal-section">
        <h2>2. AI features</h2>

        <p>
          AI features are part of CodeSquirrel Pro. They are{" "}
          <strong>off unless you use them</strong>, and this section is the
          reason this page exists.
        </p>

        <h3>Nothing is sent in the background</h3>

        <p>
          <strong>
            Content is only ever sent when you click an AI button, and only
            for the one item that button belongs to.
          </strong>{" "}
          Browsing, searching, saving, editing and uploading send nothing.
          There is no background processing, no indexing of your stash, and
          nothing that runs on a schedule.
        </p>

        <h3>What each feature does</h3>

        <ul>
          <li>
            <strong>Tag suggestions</strong> — suggests tags for an item you
            are editing.
          </li>
          <li>
            <strong>Summaries</strong> — writes a short description of an
            item.
          </li>
          <li>
            <strong>Explain this code</strong> — explains a snippet or
            command.
          </li>
          <li>
            <strong>Prompt optimizer</strong> — rewrites a saved prompt.
          </li>
        </ul>

        <p>
          Every one of them <strong>suggests</strong>. Nothing is saved until
          you accept it and press Save yourself.
        </p>

        <h3>What is sent</h3>

        <p>
          For the item you clicked on: its{" "}
          <strong>title, description and content</strong>, shortened if it is
          very long.
        </p>

        <h3>What is not sent</h3>

        <ul>
          <li>Your email address, name or account details</li>
          <li>Any other item, or the names of your collections</li>
          <li>
            <strong>Your uploaded files and images.</strong> These are never
            sent to OpenAI. For a book, only the text you typed — title,
            author, summary — could be; the cover image is not.
          </li>
        </ul>

        <h3>Where it goes</h3>

        <p>
          To <strong>OpenAI</strong>, using their <code>gpt-5-nano</code>{" "}
          model, for the length of the request. OpenAI processes the text and
          returns a suggestion.
        </p>

        <p>
          OpenAI does not use content sent through their API to train their
          models. They retain API content for a limited period for abuse
          monitoring, after which it is deleted.
        </p>

        <h3>Turning it off</h3>

        <p>
          <strong>
            <Link href="/settings">Settings</Link> → AI features.
          </strong>{" "}
          One switch turns off all four. With it off, the AI buttons do not
          appear anywhere in the app and nothing is sent to OpenAI at all.
        </p>
      </section>

      <section className="legal-section">
        <h2>3. Who else processes your data</h2>

        <p>
          CodeSquirrel is built on services that each handle one part of it:
        </p>

        <div className="legal-table-scroll">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>What it handles</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Vercel</strong>
                </td>
                <td>Hosting and serving the application</td>
              </tr>
              <tr>
                <td>
                  <strong>Neon</strong>
                </td>
                <td>The database — your account and everything you save</td>
              </tr>
              <tr>
                <td>
                  <strong>Cloudflare R2</strong>
                </td>
                <td>Files, images and book covers</td>
              </tr>
              <tr>
                <td>
                  <strong>Resend</strong>
                </td>
                <td>Verification and password-reset emails</td>
              </tr>
              <tr>
                <td>
                  <strong>Stripe</strong>
                </td>
                <td>Subscription payments</td>
              </tr>
              <tr>
                <td>
                  <strong>Upstash</strong>
                </td>
                <td>Short-lived rate-limit counters</td>
              </tr>
              <tr>
                <td>
                  <strong>OpenAI</strong>
                </td>
                <td>AI features only, and only as described in §2</td>
              </tr>
              <tr>
                <td>
                  <strong>GitHub</strong>
                </td>
                <td>Only if you choose to sign in with it</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="legal-section">
        <h2>4. Payments</h2>

        <p>
          Subscriptions are handled by Stripe.{" "}
          <strong>Card details never reach CodeSquirrel</strong> — you enter them
          on Stripe&apos;s own checkout page. We store only the identifiers
          Stripe gives us for your customer and subscription records, which is
          what lets us know whether your account is on Pro.
        </p>
      </section>

      <section className="legal-section">
        <h2>5. Security</h2>

        <ul>
          <li>
            Passwords are hashed with bcrypt and never stored or logged in
            readable form.
          </li>
          <li>
            Email verification and password-reset links are stored only as
            SHA-256 digests — a copy of our database does not let anyone use
            them.
          </li>
          <li>Changing your password signs out every other session.</li>
          <li>All traffic is over HTTPS.</li>
          <li>We do not log the content of your items.</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. Your choices</h2>

        <ul>
          <li>
            <strong>Turn off AI features</strong> —{" "}
            <Link href="/settings">Settings</Link>, at any time. Nothing is
            sent afterwards.
          </li>
          <li>
            <strong>Edit or delete anything you have saved</strong> — from
            within the app.
          </li>
          <li>
            <strong>Delete your account</strong> — Settings → Delete Account.
            It is immediate and it is yours to do; you do not have to ask us.
          </li>
          <li>
            <strong>Ask us what we hold about you</strong>, or ask for it to
            be corrected, using the contact address below.
          </li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>7. How long we keep things</h2>

        <p>Your account and everything in it stay until you delete them.</p>

        <p>
          Deleting your account immediately removes your account record and
          everything linked to it — items, collections, tags and sessions —
          from our database, and deletes the files you uploaded from file
          storage at the same time.
        </p>

        <p>
          If file storage cannot be reached at that moment, your account is
          still deleted straight away and the remaining files are removed by a
          routine cleanup that runs against the store afterwards. Nothing
          about your account survives either way: what is left is an
          unreferenced file, and it is deleted without anything having to
          identify it as yours.
        </p>

        <p>
          Verification links expire after 24 hours and password-reset links
          after one hour. Rate-limit counters expire within hours.
        </p>
      </section>

      <section className="legal-section">
        <h2>8. Contact</h2>

        <p>
          Questions about this policy, or about the data we hold:{" "}
          <a href="mailto:jkleuters@broadsight.nl">jkleuters@broadsight.nl</a>
        </p>
      </section>
    </article>
  );
}
