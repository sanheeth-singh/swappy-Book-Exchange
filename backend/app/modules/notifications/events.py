from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class NotificationKind(StrEnum):
    DIRECTORY_AVAILABILITY_CHANGED = "DIRECTORY_AVAILABILITY_CHANGED"
    REVIEW_PUBLISHED = "REVIEW_PUBLISHED"
    REVIEW_MODERATED = "REVIEW_MODERATED"
    CHAT_MESSAGE = "CHAT_MESSAGE"
    EXCHANGE_PROPOSED = "EXCHANGE_PROPOSED"
    EXCHANGE_ACCEPTED = "EXCHANGE_ACCEPTED"
    EXCHANGE_REJECTED = "EXCHANGE_REJECTED"
    EXCHANGE_CANCELLED = "EXCHANGE_CANCELLED"
    EXCHANGE_CONFIRMATION = "EXCHANGE_CONFIRMATION"
    EXCHANGE_COMPLETED = "EXCHANGE_COMPLETED"
    EXCHANGE_EXPIRED = "EXCHANGE_EXPIRED"
    EXCHANGE_ISSUE = "EXCHANGE_ISSUE"
    EXCHANGE_RESOLVED = "EXCHANGE_RESOLVED"
    MEMBERSHIP_SUBMITTED = "MEMBERSHIP_SUBMITTED"
    MEMBERSHIP_APPROVED = "MEMBERSHIP_APPROVED"
    MEMBERSHIP_REJECTED = "MEMBERSHIP_REJECTED"
    MEMBERSHIP_PROOF_EXPIRED = "MEMBERSHIP_PROOF_EXPIRED"
    REPORT_SUBMITTED = "REPORT_SUBMITTED"
    REPORT_REVIEWED = "REPORT_REVIEWED"
    LISTING_HIDDEN = "LISTING_HIDDEN"
    LISTING_RESTORED = "LISTING_RESTORED"
    PARTICIPATION_RESTRICTED = "PARTICIPATION_RESTRICTED"
    PARTICIPATION_RESTORED = "PARTICIPATION_RESTORED"


class ResourceType(StrEnum):
    EXCHANGE = "EXCHANGE"
    MEMBERSHIP = "MEMBERSHIP"
    REPORT = "REPORT"
    LISTING = "LISTING"
    ACCOUNT = "ACCOUNT"


# Fixed content only: never put proof, report allegations, chat text, or credentials here.
_TEMPLATES = {
    NotificationKind.DIRECTORY_AVAILABILITY_CHANGED: (
        ResourceType.ACCOUNT,
        "Campus availability updated",
        "Your campus availability changed. Check your profile or contact support. "
        "Existing exchange support remains available.",
    ),
    NotificationKind.REVIEW_PUBLISHED: (
        ResourceType.EXCHANGE,
        "Exchange review available",
        "A review from a completed exchange is now available.",
    ),
    NotificationKind.REVIEW_MODERATED: (
        ResourceType.EXCHANGE,
        "Review moderation updated",
        "An administrator updated the visibility of an exchange review.",
    ),
    NotificationKind.CHAT_MESSAGE: (
        ResourceType.EXCHANGE,
        "New exchange message",
        "You have a new message in an exchange chat.",
    ),
    NotificationKind.EXCHANGE_PROPOSED: (
        ResourceType.EXCHANGE,
        "New exchange proposal",
        "A student proposed a book exchange.",
    ),
    NotificationKind.EXCHANGE_ACCEPTED: (
        ResourceType.EXCHANGE,
        "Exchange accepted",
        "Your proposal was accepted. Arrange the handover.",
    ),
    NotificationKind.EXCHANGE_REJECTED: (
        ResourceType.EXCHANGE,
        "Exchange proposal closed",
        "The proposal is no longer pending.",
    ),
    NotificationKind.EXCHANGE_CANCELLED: (
        ResourceType.EXCHANGE,
        "Exchange cancelled",
        "The exchange was cancelled before confirmation.",
    ),
    NotificationKind.EXCHANGE_CONFIRMATION: (
        ResourceType.EXCHANGE,
        "Receipt confirmed",
        "The other student confirmed receipt. Check your handover.",
    ),
    NotificationKind.EXCHANGE_COMPLETED: (
        ResourceType.EXCHANGE,
        "Exchange completed",
        "Ownership has transferred. Received books are in your collection.",
    ),
    NotificationKind.EXCHANGE_EXPIRED: (
        ResourceType.EXCHANGE,
        "Exchange expired",
        "The acceptance deadline passed without receipt confirmation.",
    ),
    NotificationKind.EXCHANGE_ISSUE: (
        ResourceType.EXCHANGE,
        "Handover issue raised",
        "An unresolved exchange needs attention through support.",
    ),
    NotificationKind.EXCHANGE_RESOLVED: (
        ResourceType.EXCHANGE,
        "Support resolved your exchange",
        "An administrator recorded a handover resolution.",
    ),
    NotificationKind.MEMBERSHIP_SUBMITTED: (
        ResourceType.MEMBERSHIP,
        "Membership review needed",
        "A student submitted campus proof for review.",
    ),
    NotificationKind.MEMBERSHIP_APPROVED: (
        ResourceType.MEMBERSHIP,
        "Campus membership approved",
        "Your campus membership was verified.",
    ),
    NotificationKind.MEMBERSHIP_REJECTED: (
        ResourceType.MEMBERSHIP,
        "Membership review completed",
        "Your proof was not approved. Open membership for details.",
    ),
    NotificationKind.MEMBERSHIP_PROOF_EXPIRED: (
        ResourceType.MEMBERSHIP,
        "Student proof expired",
        "Your proof expired before review. You can submit it again.",
    ),
    NotificationKind.REPORT_SUBMITTED: (
        ResourceType.REPORT,
        "Report review needed",
        "A new report is available in the moderation queue.",
    ),
    NotificationKind.REPORT_REVIEWED: (
        ResourceType.REPORT,
        "Your report was reviewed",
        "Open your report to see the review outcome.",
    ),
    NotificationKind.LISTING_HIDDEN: (
        ResourceType.LISTING,
        "Listing hidden",
        "An administrator hid one of your listings. Check your books.",
    ),
    NotificationKind.LISTING_RESTORED: (
        ResourceType.LISTING,
        "Listing visibility restored",
        "A listing moderation flag was removed. Archived listings stay archived.",
    ),
    NotificationKind.PARTICIPATION_RESTRICTED: (
        ResourceType.ACCOUNT,
        "Participation restricted",
        "New listings and exchanges are restricted. Existing handover support remains available.",
    ),
    NotificationKind.PARTICIPATION_RESTORED: (
        ResourceType.ACCOUNT,
        "Participation restored",
        "The participation restriction was removed. Other eligibility checks still apply.",
    ),
}


@dataclass(frozen=True)
class NotificationEvent:
    recipient_id: UUID
    kind: NotificationKind
    resource_id: UUID
    event_key: str

    def __post_init__(self):
        if not self.event_key or len(self.event_key) > 200:
            raise ValueError("Use a stable event key between 1 and 200 characters.")


def template(kind: NotificationKind) -> tuple[ResourceType, str, str]:
    return _TEMPLATES[kind]
