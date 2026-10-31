"""Check shipped migration history before attempting database rehearsals."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_canonical_migration_chain_is_complete():
    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    scripts = ScriptDirectory.from_config(config)
    revisions = list(scripts.walk_revisions())
    expected = [f"{number:04d}" for number in range(13, 0, -1)]
    assert [revision.revision for revision in revisions] == expected, (
        "Migration history differs from the readiness package. Restore the complete "
        "canonical migrations directory; do not stamp or invent replacement revisions."
    )
    assert scripts.get_heads() == ["0013"]
    for number in range(1, 14):
        revision = scripts.get_revision(f"{number:04d}")
        assert revision.down_revision == (f"{number - 1:04d}" if number > 1 else None)
