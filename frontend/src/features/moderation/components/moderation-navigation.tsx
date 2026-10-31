import { ButtonLink } from "@/components/ui/button";
export function ModerationNavigation() {
  return (
    <nav aria-label="Moderation sections" className="mb-6 flex flex-wrap gap-2">
      <ButtonLink variant="secondary" href="/admin/moderation/reports">
        Safety reports
      </ButtonLink>
      <ButtonLink variant="secondary" href="/admin/moderation/reviews">
        Published reviews
      </ButtonLink>
      <ButtonLink variant="secondary" href="/admin/moderation/actions">
        Action history
      </ButtonLink>
    </nav>
  );
}
