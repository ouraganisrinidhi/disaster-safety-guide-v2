# System architecture

```mermaid
flowchart LR
  U[Student or family] --> PWA[Offline-first web application]
  A[Administrator] --> ADMIN[Protected administration dashboard]
  PWA --> CACHE[Service Worker and Cache Storage]
  PWA --> LOCAL[Local device data]
  PWA --> API[Express REST API]
  ADMIN --> API
  API --> MYSQL[(MySQL database)]
  CACHE --> PWA
  LOCAL --> PWA
```

## Storage boundaries

The MySQL database is the authoritative source for public, reviewed content and administrative records. Cache Storage contains an offline copy of application files and approved public content. The household safety plan, kit progress, bookmarks and language preference stay on the device because they are private and must remain usable without Wi-Fi.

## Publishing workflow

```mermaid
sequenceDiagram
  participant Editor as Administrator
  participant API as REST API
  participant DB as MySQL
  participant App as Offline PWA
  Editor->>API: Save draft
  API->>DB: Record content and audit entry
  Editor->>API: Approve reviewed version
  API->>DB: Publish content version
  App->>API: Check version when online
  API-->>App: New reviewed version metadata
  App->>App: Cache update for later use
```

## Security model

- Public guidance never requires authentication.
- Administration endpoints require a server-side session.
- Credentials and session secrets are supplied through local environment configuration and are excluded from Git.
- SQL values use prepared statements.
- Personal household data is not uploaded.
- Administrative changes are recorded in `audit_log`.
