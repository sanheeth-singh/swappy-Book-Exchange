# Milestone 2: book listings and ImageKit photos

## Updating an existing installation (PowerShell)

Stop the API. Back up your working directory and database first.
Copy the package's backend/app, backend/migrations, backend/tests,
backend/pyproject.toml, and backend/requirements-dev.lock into your existing
project. Keep your own .env, virtual environment, compose passwords, and database
volume. Do not replace or regenerate migration 0001 in an existing database.

From backend, with the virtual environment activated:

```powershell
python -m pip install -r requirements-dev.lock
python -m pip install -e .
alembic upgrade head
python -m uvicorn app.main:app --reload
```

Add IMAGEKIT_PRIVATE_KEY to backend/.env using your ImageKit dashboard private
key. It is only used on the server. This implementation uses ImageKit's returned
delivery URL; no public key or URL endpoint setting is required.
Existing authentication and student-proof storage are unchanged.

The lock file now marks uvloop as non-Windows to avoid the Windows installation
failure. The ImageKit SDK is version 5, matching the supplied integration guide.

## Swagger walkthrough

Sign in; complete a profile; obtain manual approval through the existing
reviewer flow. Every write rechecks active verification under the same user-row
lock used by profile changes and membership review.

1. POST /api/v1/books with JSON:
   {"title":"Database Systems","author":"Author","description":"Study copy",
    "condition":"GOOD","condition_notes":"Some pencil notes"}
2. POST /api/v1/books/{id}/photos using multipart field "photo".
   Repeat for up to three photos.
3. GET /api/v1/books?q=Database&limit=20&offset=0.
4. GET /api/v1/books/{id} for campus-scoped details.
5. GET /api/v1/books/me includes your archived listings.
6. PUT /api/v1/books/{id} replaces the editable text fields.
7. POST /api/v1/books/{id}/archive withdraws the listing, idempotently.

A listing can be created without photos; adding photos is a second operation.
Photo removal/replacement is not included in this milestone. Archived records and
their images are retained for history. Campus transfer archives old listings.
A user whose verification expires can still withdraw their own listing.

No API accepts a supplied image URL, ImageKit file ID, owner ID, or campus ID
on listing creation. Ownership and campus come from the authenticated account.
Other users' listings cannot be edited, archived, or given photos. Browsing and
detail lookup exclude archived and other-campus listings; ownership-based
"My books" includes your own history across campuses.

## Photos

Static JPEG, PNG, and WebP only; maximum input 5 MiB and 20 megapixels.
Content is decoded independently of MIME type and filename. Animated images,
SVGs, malformed images, and oversized images are rejected. The server applies
EXIF orientation, strips metadata, resizes to at most 2000 x 2000, and emits JPEG.
Book images are publicly delivered assets: never upload student proof here.
Opaque public image URLs can be shared; campus API authorization does not make
ImageKit delivery private.

Uploads hold a listing lock to serialize the three-photo limit. SDK calls have a
30-second timeout and automatic retries disabled. If the database commit fails,
the service rolls back and attempts remote cleanup; failed cleanup logs the
ImageKit file ID for manual reconciliation. A process crash or ambiguous upload
timeout can leave an orphan. Durable upload reconciliation is a follow-up; do
not describe storage and PostgreSQL as one atomic transaction.

At deployment, configure an upstream request-body limit (e.g. 6 MiB) as well as
request/rate limits. The application reads only 5 MiB + 1 byte from UploadFile,
but multipart parsing occurs before that check. Uploaded filenames are discarded.

## Validation

Locally: 27 tests passed; 8 PostgreSQL API tests skipped without TEST_DATABASE_URL.
Lint passes. Alembic upgrades 0001 -> 0002 compile as PostgreSQL SQL.
Live ImageKit calls were not made; real credentials are not present.

Run all API tests against a dedicated PostgreSQL test database:

```powershell
$env:TEST_DATABASE_URL="postgresql+asyncpg://USER:PASSWORD@localhost:5432/swappy_test"
python -m pytest -q
```

The suite uses isolated schemas but needs permission to create/drop schemas.
ImageKit is replaced with a fake in API tests; no real uploads are performed.
Existing onboarding campus isolation tests remain part of the suite.
