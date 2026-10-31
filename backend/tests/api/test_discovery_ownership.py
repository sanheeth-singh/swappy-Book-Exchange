from tests.api.test_books import PAYLOAD, verify
from tests.api.test_onboarding import setup, signup


async def test_discovery_contains_other_campus_students_but_not_self_or_other_campus(
    client, campuses, session_factory
):
    owner = await signup(client)
    await setup(client, owner, campuses[0])
    await verify(session_factory, "student@example.com", campuses[0])
    own = (await client.post("/api/v1/books", headers=owner, json=PAYLOAD)).json()
    peer = await signup(client, "peer@example.com")
    await setup(client, peer, campuses[0])
    await verify(session_factory, "peer@example.com", campuses[0])
    other = (
        await client.post("/api/v1/books", headers=peer, json={**PAYLOAD, "title": "Peer book"})
    ).json()
    away = await signup(client, "away@example.com")
    await setup(client, away, campuses[1])
    await verify(session_factory, "away@example.com", campuses[1])
    cross = (await client.post("/api/v1/books", headers=away, json=PAYLOAD)).json()
    ids = {book["id"] for book in (await client.get("/api/v1/books", headers=owner)).json()}
    assert other["id"] in ids
    assert own["id"] not in ids
    assert cross["id"] not in ids
    assert own["id"] in {
        book["id"] for book in (await client.get("/api/v1/books/me", headers=owner)).json()
    }
