import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { DefinitionList } from "../components/definition-list";
import {
  conditions,
  exchangeStatuses,
  helpTopics,
  issueStatuses,
  journey,
  membershipStatuses,
  reportReasons,
  reportStatuses,
} from "../content";
import { genreGuide } from "../genres";
export function HelpScreen() {
  return (
    <div className="container py-9 md:py-12">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The Swappy guide</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Know what happens next.</h1>
          <p className="mt-4 max-w-2xl text-muted">
            From your first look at the shelves to a completed exchange. Find
            the meaning behind each step and label.
          </p>
        </div>
        <ButtonLink href="/explore" variant="secondary">
          Explore books
        </ButtonLink>
      </div>
      <div className="help-layout mt-8">
        <aside>
          <nav aria-label="Help topics" className="help-contents">
            <p className="eyebrow mb-3">On this page</p>
            {helpTopics.map((topic) => (
              <Link key={topic.id} href={`#${topic.id}`}>
                {topic.title}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="help-sections">
          <section id="getting-started">
            <h2>Start with a look around.</h2>
            <p>
              The public Explore page shows a limited selection of listings
              whose owners opted in to public preview. It shows book
              information, not the full private campus catalog or owners’
              personal details.
            </p>
            <p>
              Register, then complete your display name and campus selection to
              browse campus books. New listings, proposals and acceptance need
              active verification. Exchanges take place between students on the
              same campus.
            </p>
            <div className="help-note">
              This guide describes the platform’s backend-supported workflows.
              Account, verification and campus book screens are available.
              Administrators have their own review and directory workspace.
              Student exchange proposals, handover confirmations and issue
              submission are now available.
            </div>
          </section>
          <section id="membership">
            <h2>Campus verification.</h2>
            <p>
              Choose your campus and submit proof of enrollment for manual
              review. An administrator approves or rejects the submission. Check
              the review reason and any expiry date.
            </p>
            <Disclosure title="What each membership label means">
              <DefinitionList entries={membershipStatuses} />
            </Disclosure>
            <p>
              Verified is only one part of eligibility: membership must also be
              active, unexpired and match your selected campus. Your college and
              campus must be active for new activity, and participation
              restrictions may also apply.
            </p>
            <p>
              Existing handover confirmation and support access can remain
              available after verification expires. Sending new chat messages
              still requires eligibility; read the availability message shown in
              the conversation.
            </p>
          </section>
          <section id="books">
            <h2>Describe the book you actually have.</h2>
            <p>
              Provide its title, author, genre, description and condition. Use
              condition notes and photos to explain wear rather than relying on
              a badge alone.
            </p>
            <Disclosure title="Book condition guide">
              <p className="mb-4">
                These are suggested descriptions for consistent listings, not an
                inspection or guarantee from Swappy.
              </p>
              <DefinitionList entries={conditions} />
            </Disclosure>
            <Disclosure title="All book genres">
              <DefinitionList entries={genreGuide} />
            </Disclosure>
            <Disclosure title="Available, reserved, archived and hidden">
              <DefinitionList
                entries={{
                  available: {
                    label: "Available",
                    description:
                      "A listing that is not reserved, archived or hidden may be eligible for an exchange; account and campus rules still apply.",
                  },
                  reserved: {
                    label: "Reserved",
                    description:
                      "The physical book is committed to an accepted exchange and cannot be offered in another accepted exchange.",
                  },
                  archived: {
                    label: "Archived",
                    description:
                      "The listing is no longer an active offer. Completion archives both original listings; a new owner can list their physical copy again.",
                  },
                  hidden: {
                    label: "Hidden",
                    description:
                      "The listing is withheld from normal discovery, for example following moderation.",
                  },
                  preview: {
                    label: "Public preview enabled",
                    description:
                      "The owner opted the listing into the limited public selection. Eligibility checks still decide whether it appears.",
                  },
                }}
              />
            </Disclosure>
          </section>
          <section id="exchange-journey">
            <h2>The exchange journey.</h2>
            <p>
              A proposal is an invitation. Acceptance reserves the books. Only
              receipt confirmation tells Swappy that a physical handover
              happened.
            </p>
            <ol className="journey-list">
              {journey.map((step, index) => (
                <li key={step.title}>
                  <span className="process-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <span className="badge mt-2">{step.status}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="help-note">
              Never confirm receipt just to unlock a screen or reserve a book.
              Confirm only after the other book is in your hands.
            </div>
            <p>
              After completion, ownership transfers between the two physical
              books, both original listings are archived, and reservations are
              released. Find the received book in your collection and create a
              new listing when you want to pass it on.
            </p>
          </section>
          <section id="statuses">
            <h2>Every exchange status, explained.</h2>
            <DefinitionList entries={exchangeStatuses} />
            <Disclosure title="Cancellation, expiry and unresolved handovers">
              <p>
                While a proposal is pending, only its requester can withdraw it.
                After acceptance, either participant can cancel until the first
                receipt confirmation.
              </p>
              <p>
                An accepted exchange without either confirmation has a six-day
                deadline. Expiry is applied when the backend processes the
                exchange; it is not a browser timer.
              </p>
              <p>
                Once one person has confirmed, the exchange waits for the other
                confirmation. It does not automatically expire under the
                accepted-only rule. Raise an issue if the handover needs
                administrator help.
              </p>
            </Disclosure>
          </section>
          <section id="chat-reviews">
            <h2>Keep the conversation with the exchange.</h2>
            <p>
              Chat opens after acceptance. Sending is limited to accepted or
              waiting-for-confirmation exchanges while participation and
              interaction rules allow it. After closure, existing participants
              can read the history but cannot send new messages.
            </p>
            <Disclosure title="Reviews and reputation">
              <p>
                After completion, each participant has a 14-day window to submit
                one review with a rating from 1 to 5 and an optional comment.
                Submitted reviews cannot be edited.
              </p>
              <p>
                Reviews publish when both have been submitted or when the review
                window ends and publication is processed. Moderation can hide
                published reviews.
              </p>
              <p>
                “Not enough history” means there are fewer than three distinct
                published reviewers for a trust score. “Available” means a score
                can be calculated; it is not a guarantee about another person.
              </p>
            </Disclosure>
          </section>
          <section id="issues">
            <h2>When something needs attention.</h2>
            <p>
              An exchange issue concerns an unresolved accepted handover.
              Describe the problem clearly. Each participant can have one open
              issue per exchange; an open issue blocks ordinary confirmations
              until an administrator resolves the exchange. Reporting an issue
              does not itself transfer ownership.
            </p>
            <Disclosure title="Exchange issue labels">
              <DefinitionList entries={issueStatuses} />
            </Disclosure>
            <p>
              A report is a separate moderation concern about a user or listing.
              Choose a reason and provide useful details. Blocking prevents new
              interactions where the backend enforces that restriction; it does
              not erase exchange history or completed-exchange review rights.
            </p>
            <Disclosure title="Report reasons">
              <DefinitionList entries={reportReasons} />
            </Disclosure>
            <Disclosure title="Report outcomes">
              <DefinitionList entries={reportStatuses} />
            </Disclosure>
          </section>
          <section id="reference">
            <h2>More labels you may see.</h2>
            <Disclosure title="Recommendations">
              <DefinitionList
                entries={{
                  genre: {
                    label: "Genre match",
                    description:
                      "A recommendation based on relevant genre preferences from reading interests or listing history.",
                  },
                  recent: {
                    label: "Recent available",
                    description:
                      "A recommendation drawn from recently available books.",
                  },
                }}
              />
            </Disclosure>
            <Disclosure title="Administrator outcomes">
              <DefinitionList
                entries={{
                  complete: {
                    label: "Complete exchange",
                    description:
                      "An administrator resolves an unresolved accepted exchange by completing the ownership transfer.",
                  },
                  cancel: {
                    label: "Cancel exchange",
                    description:
                      "An administrator closes the exchange without transferring ownership and releases reservations.",
                  },
                  dismiss: {
                    label: "Dismiss report",
                    description: "Close a report without upholding it.",
                  },
                  resolve: {
                    label: "Resolve report",
                    description: "Record the report as resolved.",
                  },
                  hide: {
                    label: "Hide listing or review",
                    description:
                      "Remove the affected content from normal public visibility.",
                  },
                  restrict: {
                    label: "Restrict user",
                    description:
                      "Restrict the account’s participation; this is separate from account deactivation.",
                  },
                  restore: {
                    label: "Restore",
                    description:
                      "Restore visibility or participation after administrative review.",
                  },
                  inactive: {
                    label: "College or campus inactive",
                    description:
                      "New activity is stopped while records and existing handover or support paths are preserved.",
                  },
                }}
              />
            </Disclosure>
            <Disclosure title="Notifications and account labels">
              <p>
                Notifications describe events such as a proposal, acceptance,
                confirmation, issue, review or membership decision. Unread means
                you have not marked the notification read; it does not change
                the exchange status.
              </p>
              <p>
                A session is a signed-in device or browser session. Revoking one
                ends that session. Account deactivation is separate from campus
                verification and has its own backend eligibility checks.
              </p>
            </Disclosure>
            <Card className="mt-6 p-5">
              <h3>Ready to look at the shelves?</h3>
              <p>
                The public preview has its own space, with search and genre
                filters.
              </p>
              <ButtonLink href="/explore" className="mt-4">
                Explore books
              </ButtonLink>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
