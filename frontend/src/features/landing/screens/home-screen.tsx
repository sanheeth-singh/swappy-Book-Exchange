import { DiscoveryLink } from "@/components/ui/discovery-link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { ExchangeStory } from "../components/exchange-story";
import { ReuseSlider } from "../components/reuse-slider";
const steps = [
  {
    number: "01",
    title: "Find a book",
    body: "Explore the public preview, then discover your campus shelves after completing your profile.",
  },
  {
    number: "02",
    title: "Offer an exchange",
    body: "With active campus verification, offer your book for another student’s listing.",
  },
  {
    number: "03",
    title: "Meet and confirm",
    body: "After acceptance, arrange a handover. Each person confirms the book they received.",
  },
];
export function HomeScreen() {
  return (
    <>
      <section className="container hero-section">
        <div>
          <p className="eyebrow">Good reads. Closer to home.</p>
          <h1 className="hero-title mt-4">
            Your next read is on
            <br className="hidden lg:block" />{" "}
            <span className="text-accent">someone else’s shelf.</span>
          </h1>
          <p className="mt-5 max-w-lg text-muted">
            Pass on a book you loved. Find a story you haven’t met. Exchange
            with students on your campus.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <DiscoveryLink />
            <ButtonLink href="/register" variant="secondary">
              Join your campus
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs text-muted">
            Preview the shelves without an account.
          </p>
        </div>
        <ExchangeStory />
      </section>
      <section className="container">
        <div className="discovery-invitation">
          <div>
            <p className="eyebrow">A glimpse, not the whole shelf</p>
            <h2 className="mt-2 text-xl">Curious what’s out there?</h2>
            <p className="mt-2 text-sm text-muted">
              Search the public selection on our dedicated discovery page.
            </p>
          </div>
          <DiscoveryLink variant="secondary" />
        </div>
      </section>
      <section
        className="container section-space"
        aria-labelledby="how-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">A simple exchange</p>
            <h2 id="how-heading" className="mt-2 text-2xl">
              From your shelf to theirs.
            </h2>
          </div>
          <ButtonLink href="/help#exchange-journey" variant="ghost">
            Read the full guide
          </ButtonLink>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.number} className="process-step">
              <span className="process-number">{step.number}</span>
              <div>
                <h3 className="text-base">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section
        className="container section-space"
        aria-label="Book reuse illustration"
      >
        <ReuseSlider />
      </section>
      <section className="container section-space">
        <div className="verification-note">
          <div>
            <p className="eyebrow">Built around your campus</p>
            <h2 className="mt-2 text-2xl">
              A shared campus. A clearer starting point.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Creating listings and starting exchanges require active campus
              verification. Browse first, learn the rules, then take part when
              you’re ready.
            </p>
          </div>
          <ButtonLink href="/help#membership" variant="secondary">
            About verification
          </ButtonLink>
        </div>
      </section>
      <section
        className="container section-space"
        aria-labelledby="questions-heading"
      >
        <div className="section-heading">
          <h2 id="questions-heading" className="text-2xl">
            A few things to know.
          </h2>
          <ButtonLink href="/help" variant="ghost">
            All help topics
          </ButtonLink>
        </div>
        <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
          <Disclosure title="Can I explore before registering?">
            <p>
              Yes. Explore shows a limited, publicly shared selection. Campus
              browsing requires an account with a completed name and campus
              selection.
            </p>
          </Disclosure>
          <Disclosure title="When should I confirm an exchange?">
            <p>
              Only after you receive the other book. Acceptance reserves the
              books; it does not confirm that the physical handover happened.
            </p>
          </Disclosure>
        </div>
      </section>
      <section className="container section-space">
        <div className="final-invitation">
          <h2 className="text-2xl">
            A little space on your shelf.
            <br />A new story in your hands.
          </h2>
          <DiscoveryLink />
        </div>
      </section>
    </>
  );
}
