from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

REVIEW_WINDOW = timedelta(days=14)
TRUST_VERSION = "distinct-reviewer-v1"
MIN_REVIEWERS = 3
PRIOR_WEIGHT = Decimal(5)
PRIOR_RATING = Decimal(3)


def trust_score(reviewer_means: list[Decimal]) -> Decimal | None:
    """Each distinct reviewer contributes once. Return a bounded, smoothed 0–100 score."""
    if len(reviewer_means) < MIN_REVIEWERS:
        return None
    if any(
        not value.is_finite() or not Decimal(1) <= value <= Decimal(5) for value in reviewer_means
    ):
        raise ValueError("Reviewer means must be finite ratings from 1 to 5.")
    mean = (sum(reviewer_means) + PRIOR_WEIGHT * PRIOR_RATING) / (
        len(reviewer_means) + PRIOR_WEIGHT
    )
    return ((mean - 1) * 25).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
