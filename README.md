# Disaster Safety Guide

An offline-first Progressive Web App for disaster preparedness, first-aid learning, emergency contacts, household planning, and emergency-kit tracking.

The project also includes a protected administration dashboard, MySQL content-management schema, feedback review workflow, audit logging, content version checks, API documentation, and automated backend checks.

Visitors can optionally create an account, sign in, and maintain a basic profile and language preference. Public emergency guidance never requires an account; household plans and checklists remain device-local for offline access and privacy.

## Why this stack

- **Vanilla HTML, CSS and JavaScript PWA:** very small download, fast on lower-powered phones, and easy to cache for offline use.
- **Node.js + Express:** a minimal server with little framework overhead.
- **MySQL:** maintainable emergency-contact and content-review data, compatible with MySQL Workbench.
- **Local browser storage:** private plans, bookmarks and checklists remain useful without Wi-Fi or a database connection.

The emergency experience never depends on the server or MySQL after the first successful load.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Optional: open `database/schema.sql` in MySQL Workbench and run it, then update `.env` with your local MySQL password.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Without MySQL configuration, the site still runs using its bundled offline content.

## Administrator setup

In the local `.env` file, replace the example values for:

```text
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=use-a-strong-local-password
SESSION_SECRET=use-a-long-random-secret
```

Restart the server and open `http://localhost:3000/#admin`. Never commit `.env` or use the example password for a public deployment.

The administration dashboard manages verified emergency contacts and feedback, displays content-review counts, and documents the reviewed publishing workflow. The MySQL schema also contains normalized disaster, translation, first-aid, kit, quiz, content-version and audit tables for continued development.

## Quality checks

Run:

```powershell
npm run check
npm test
```

Architecture and API documentation are in `docs/architecture.md` and `docs/api.md`.

## Offline test

1. Open the site once while online/local server is running.
2. In browser developer tools, confirm the service worker is active.
3. Select **Offline** in the Network panel, then refresh.
4. Test disaster guides, first aid, contacts, checklist, safety plan, language preference, search and bookmarks.

Service workers require HTTPS in production; localhost is allowed for development.

## Safety review before public release

The software includes visible review notices because public deployment requires:

- verification of every emergency number for the intended region;
- qualified medical review of first-aid instructions;
- authoritative source and review metadata for every guide;
- reviewed Telugu and Hindi safety-content translations;
- device and accessibility testing, including offline cold starts.

The interface does not claim to contact responders or provide live alerts.
