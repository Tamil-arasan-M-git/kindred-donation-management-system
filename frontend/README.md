# Kindred Frontend

Kindred is a role-based React/Vite frontend for intelligent donation
management. It supports donor, NGO, and administrator workflows and connects
to the Kindred backend through `src/api/client.js`.

## Capabilities

### Donor dashboard

The donor experience helps people create, track, and complete donations.

- Dashboard overview with donation totals, active matches, pickup due, completed
  donations, impact, recent activity, and profile-completion reminders.
- Upload an image from a device or capture a live photo with the browser
  camera.
- Send the same captured/uploaded `File` through `POST /detect`.
- Review detected categories, edit quantities, remove incorrect items, and
  submit a donation.
- View donation history and donation details.
- Review recommended NGO matches.
- View pickup information and cancellation actions where supported by the API.
- Update donor profile information.
- Receive and manage notification read state through the notification bell.

### NGO dashboard

The NGO experience supports demand intake and donation operations.

- Dashboard overview with active demands, incoming matches, accepted matches,
  active donations, demand summaries, and recent activity.
- Create, edit, and delete donation demands with category, quantity, priority,
  and notes.
- Review matching donations and accept or reject matches with reasons.
- Browse incoming donations and open donation details.
- Manage pickup, packaging, status, and operational actions where supported.
- View, create, update, and deactivate NGO staff accounts.
- View NGO operations and daily operation activity.
- Update the NGO profile.

### Admin dashboard

The administrator experience provides platform-wide monitoring and management.

- Platform overview with registered donors, registered NGOs, donations, active
  demands, and matches.
- Network snapshot showing verified/unverified NGOs, acknowledged donations,
  active donations, and open matches.
- Review NGO records and toggle backend verification state after confirmation.
- Browse registered donors with pagination and donor details.
- Monitor donations, filter by status, and inspect donation history and
  backend-created matches.
- Review NGO demands and filter demand records.
- Review backend-created matches across NGOs and filter by match status.

## Folder structure

```text
frontend/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── api/
│   │   └── client.js                 # Central HTTP/API client
│   ├── assets/                       # Static application assets
│   ├── components/
│   │   ├── common/                   # Buttons, cards, loading, errors, camera
│   │   ├── donations/                # Donation lifecycle and NGO operations
│   │   ├── layout/                   # Shell, navigation, headers, summaries
│   │   └── notifications/             # Notification bell and read actions
│   ├── context/
│   │   └── AuthContext.jsx            # Authentication/session state
│   ├── pages/
│   │   ├── auth/                     # Login, registration, auth layout
│   │   ├── donor/                    # Donor dashboard and workflows
│   │   ├── ngo/                      # NGO dashboard and workflows
│   │   └── admin/                    # Admin dashboard and management pages
│   ├── routes/
│   │   ├── AppRoutes.jsx              # Route definitions and role groups
│   │   └── ProtectedRoute.jsx         # Role-based route protection
│   ├── utils/
│   │   └── status.js                 # Shared status labels and classes
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## Route map

### Public routes

| Route | Purpose |
| --- | --- |
| `/login` | Sign in to an existing account |
| `/register` | Register a donor or NGO account |

### Donor routes

All donor routes require the `donor` role.

| Route | Page and capability |
| --- | --- |
| `/donor` | Donor dashboard |
| `/donor/scan` | Upload an image or capture a live photo for detection |
| `/donor/review` | Review/edit detected donation items before submission |
| `/donor/donations` | List the donor's donations |
| `/donor/donations/:id` | View donation details and lifecycle actions |
| `/donor/donations/:id/matches` | Compatibility alias for the donation detail view |
| `/donor/matches` | Review recommended NGO matches |
| `/donor/pickup` | View pickup information and available pickup actions |
| `/donor/profile` | View and edit donor profile |

### NGO routes

All NGO routes require the `ngo` role.

| Route | Page and capability |
| --- | --- |
| `/ngo` | NGO operations dashboard |
| `/ngo/demands` | Create and manage donation demands |
| `/ngo/matches` | Review and act on NGO matches |
| `/ngo/matches/:id` | Match route handled by the NGO matches view |
| `/ngo/donations` | Browse incoming donations |
| `/ngo/donations/:id` | Inspect donation details and operational actions |
| `/ngo/operations` | Manage NGO operational assignments |
| `/ngo/staff` | Manage NGO staff accounts |
| `/ngo/profile` | View and edit NGO profile |

### Admin routes

All admin routes require the `admin` role.

| Route | Page and capability |
| --- | --- |
| `/admin` | Platform health and network overview |
| `/admin/ngos` | Review NGOs and manage verification state |
| `/admin/donors` | Browse registered donors with pagination |
| `/admin/donations` | Monitor donations, statuses, history, and matches |
| `/admin/demands` | Review NGO demands |
| `/admin/matches` | Review matches across the NGO network |

The root route `/` and unknown routes redirect to the signed-in user's role
home. Unauthenticated users are redirected to `/login`.

## API integration

The API base URL is configured with `VITE_API_BASE_URL` and defaults to
`http://localhost:8000`.

The API client handles authentication headers, JSON requests, multipart image
uploads, donation lifecycle actions, matching, notifications, donor/NGO
dashboards, NGO staff, and NGO operations. The donor camera and device-upload
flows both use the same `detectImage(file)` method and `/detect` endpoint.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

Do not commit `.env` or generated directories such as `node_modules/` and
`dist/`. Use `.env.example` as the configuration template.
