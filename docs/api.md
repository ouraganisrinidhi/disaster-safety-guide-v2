# REST API reference

## Public endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Application and database readiness |
| GET | `/api/content-version` | Latest reviewed content version |
| GET | `/api/contacts?region=IN` | Active regional emergency contacts |
| POST | `/api/feedback` | Submit a correction or accessibility report |

## Administrator endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/admin/login` | Create administrator session |
| POST | `/api/admin/logout` | End administrator session |
| GET | `/api/admin/session` | Read current session state |
| GET | `/api/admin/dashboard` | Content and feedback counts |
| GET | `/api/admin/contacts` | List all emergency contacts |
| POST | `/api/admin/contacts` | Add a verified emergency contact |
| PUT | `/api/admin/contacts/:id` | Update contact metadata/status |
| DELETE | `/api/admin/contacts/:id` | Archive a contact without deleting history |
| GET | `/api/admin/feedback` | List submitted reports |
| PUT | `/api/admin/feedback/:id` | Update report review status |

All administrator endpoints except login and session inspection require an authenticated HTTP-only session cookie.
