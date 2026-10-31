from dataclasses import dataclass


@dataclass(frozen=True)
class Avatar:
    id: str
    name: str
    url: str


AVATARS = tuple(
    Avatar(f"reader_{i:02d}", name, f"/assets/avatars/reader_{i:02d}.svg")
    for i, name in enumerate(
        (
            "Sunrise reader",
            "Forest reader",
            "Ocean reader",
            "Berry reader",
            "Moonlight reader",
            "Amber reader",
            "Mint reader",
            "Rose reader",
            "Sky reader",
            "Lavender reader",
            "Coral reader",
            "Sage reader",
            "Indigo reader",
            "Peach reader",
            "Teal reader",
        ),
        start=1,
    )
)
AVATAR_IDS = tuple(avatar.id for avatar in AVATARS)
DEFAULT_AVATAR = AVATAR_IDS[0]


def avatar_url(avatar_id: str) -> str:
    if avatar_id not in AVATAR_IDS:
        raise ValueError("Unknown avatar")
    return f"/assets/avatars/{avatar_id}.svg"
