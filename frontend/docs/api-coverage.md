# API coverage

All 90 backend operations remain inventoried: 69 integrated, 19 planned, 1 operational, 1 intentionally unused. Integration status records frontend coverage; live acceptance is separate.

| Method | Path | Status | Screen |
| --- | --- | --- | --- |
| GET | `/health` | operational | health monitoring |
| POST | `/api/v1/auth/register` | integrated | /register |
| POST | `/api/v1/auth/token` | integrated | /login |
| GET | `/api/v1/auth/csrf` | integrated | Global session provider and header |
| POST | `/api/v1/auth/refresh` | integrated | Global session provider and header |
| POST | `/api/v1/auth/logout` | integrated | Global session provider and header |
| POST | `/api/v1/auth/logout-all` | planned | /settings/sessions |
| GET | `/api/v1/auth/sessions` | planned | /settings/sessions |
| POST | `/api/v1/auth/sessions/{session_id}/revoke` | planned | /settings/sessions |
| GET | `/api/v1/users/me` | integrated | Global session provider and header |
| GET | `/api/v1/users/me/profile` | planned | /profile, /users/[userId], /settings/profile |
| PUT | `/api/v1/users/me/profile` | integrated | /profile |
| PATCH | `/api/v1/users/me/profile` | planned | /profile, /users/[userId], /settings/profile |
| GET | `/api/v1/colleges` | intentionally-unused | Campus selector uses /campuses, which already includes college names |
| GET | `/api/v1/campuses` | integrated | /profile |
| GET | `/api/v1/admin/colleges` | integrated | /admin/directory |
| POST | `/api/v1/admin/colleges` | integrated | /admin/directory |
| PATCH | `/api/v1/admin/colleges/{college_id}` | integrated | /admin/directory |
| POST | `/api/v1/admin/colleges/{college_id}/status` | integrated | /admin/directory |
| GET | `/api/v1/admin/colleges/{college_id}/impact` | integrated | /admin/directory |
| GET | `/api/v1/admin/campuses` | integrated | /admin/directory |
| POST | `/api/v1/admin/campuses` | integrated | /admin/directory |
| PATCH | `/api/v1/admin/campuses/{campus_id}` | integrated | /admin/directory |
| POST | `/api/v1/admin/campuses/{campus_id}/status` | integrated | /admin/directory |
| GET | `/api/v1/admin/campuses/{campus_id}/impact` | integrated | /admin/directory |
| GET | `/api/v1/admin/directory/actions` | integrated | /admin/directory |
| GET | `/api/v1/membership/me` | integrated | /membership |
| GET | `/api/v1/membership/eligibility` | integrated | /membership |
| GET | `/api/v1/membership/submissions` | integrated | /admin/memberships |
| POST | `/api/v1/membership/submissions` | integrated | /membership |
| GET | `/api/v1/membership/submissions/{submission_id}/document` | integrated | /admin/memberships |
| POST | `/api/v1/membership/submissions/{submission_id}/review` | integrated | /admin/memberships |
| GET | `/api/v1/books` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| POST | `/api/v1/books` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| GET | `/api/v1/books/genres` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| GET | `/api/v1/books/recommendations` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| GET | `/api/v1/books/me` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| GET | `/api/v1/books/collection` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| PUT | `/api/v1/books/{book_id}` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| GET | `/api/v1/books/{book_id}` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| POST | `/api/v1/books/{book_id}/archive` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| PATCH | `/api/v1/books/{book_id}/public-preview` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| POST | `/api/v1/books/{book_id}/photos` | integrated | /books, /books/[bookId], /my-books, /my-books/new, /my-books/[bookId]/edit, /collection |
| POST | `/api/v1/exchanges` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| GET | `/api/v1/exchanges/sent` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| GET | `/api/v1/exchanges/received` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| GET | `/api/v1/exchanges/admin/issues` | integrated | /admin/issues |
| GET | `/api/v1/exchanges/admin/{exchange_id}` | integrated | /admin/issues |
| POST | `/api/v1/exchanges/{exchange_id}/accept` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| POST | `/api/v1/exchanges/{exchange_id}/reject` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| POST | `/api/v1/exchanges/{exchange_id}/cancel` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| POST | `/api/v1/exchanges/{exchange_id}/confirm` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| POST | `/api/v1/exchanges/{exchange_id}/issues` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| GET | `/api/v1/exchanges/{exchange_id}/issues` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| POST | `/api/v1/exchanges/{exchange_id}/resolve` | integrated | /admin/issues |
| GET | `/api/v1/exchanges/{exchange_id}` | integrated | /books/[bookId], /exchanges, /exchanges/[exchangeId] |
| GET | `/api/v1/blocks` | integrated | /safety · reader/exchange block controls |
| POST | `/api/v1/blocks/{user_id}` | integrated | /safety · reader/exchange block controls |
| POST | `/api/v1/blocks/{user_id}/unblock` | integrated | /safety · reader/exchange block controls |
| GET | `/api/v1/exchanges/{exchange_id}/chat/messages` | integrated | /exchanges/[exchangeId] · conversation |
| POST | `/api/v1/exchanges/{exchange_id}/chat/messages` | integrated | /exchanges/[exchangeId] · conversation |
| POST | `/api/v1/exchanges/{exchange_id}/chat/read` | integrated | /exchanges/[exchangeId] · conversation |
| POST | `/api/v1/reports` | integrated | /safety · reports |
| GET | `/api/v1/reports/me` | integrated | /safety · reports |
| GET | `/api/v1/reports/{report_id}` | integrated | /safety · reports |
| POST | `/api/v1/exchanges/{exchange_id}/reviews` | integrated | /exchanges/[exchangeId] · /readers/[userId] |
| GET | `/api/v1/exchanges/{exchange_id}/reviews` | integrated | /exchanges/[exchangeId] · /readers/[userId] |
| GET | `/api/v1/users/{user_id}/reviews` | integrated | /exchanges/[exchangeId] · /readers/[userId] |
| GET | `/api/v1/users/{user_id}/reputation` | integrated | /readers/[userId] |
| GET | `/api/v1/moderation/reviews` | planned | /admin/moderation |
| POST | `/api/v1/moderation/reviews/{review_id}` | planned | /admin/moderation |
| GET | `/api/v1/moderation/reviews/{review_id}/actions` | planned | /admin/moderation |
| GET | `/api/v1/moderation/reports` | planned | /admin/moderation |
| GET | `/api/v1/moderation/reports/{report_id}` | planned | /admin/moderation |
| POST | `/api/v1/moderation/reports/{report_id}/review` | planned | /admin/moderation |
| POST | `/api/v1/moderation/users/{user_id}/restore` | planned | /admin/moderation |
| POST | `/api/v1/moderation/listings/{listing_id}/restore` | planned | /admin/moderation |
| GET | `/api/v1/moderation/actions` | planned | /admin/moderation |
| GET | `/api/v1/notifications` | integrated | /notifications · header unread count |
| GET | `/api/v1/notifications/unread-count` | integrated | /notifications · header unread count |
| POST | `/api/v1/notifications/read-all` | integrated | /notifications · header unread count |
| POST | `/api/v1/notifications/{notification_id}/read` | integrated | /notifications · header unread count |
| GET | `/api/v1/users/avatars` | planned | /profile, /users/[userId], /settings/profile |
| GET | `/api/v1/users/me/deactivation` | planned | /settings/account |
| POST | `/api/v1/users/me/password` | planned | /settings/account |
| POST | `/api/v1/users/me/deactivate` | planned | /settings/account |
| GET | `/api/v1/users/{user_id}/profile` | integrated | /readers/[userId] |
| GET | `/api/v1/users/{user_id}/books` | planned | /profile, /users/[userId], /settings/profile |
| GET | `/api/v1/public/books` | integrated | /explore |
| DELETE | `/api/v1/books/{book_id}/photos/{photo_id}` | integrated | /my-books/[bookId]/edit |
