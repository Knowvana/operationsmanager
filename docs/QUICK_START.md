# Operations Manager — Quick Start Guide

Welcome to the Operations Manager platform. This guide will get you up and running in minutes.

## Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- Firebase project configured (see `src/config/firebase.json`)

## Installation

```bash
npm install
```

## Starting the Development Server

```bash
npm run dev
```

The dev server will start and display the local URL (typically `http://localhost:5174`).

---

## Access URLs

### System Administrator Dashboard
**URL:** `http://localhost:5174/admin-setup`

**Purpose:** Platform administration, database setup, tenant management, system configuration

**Default Credentials:**
- **Email:** `admin@knowvana.com`
- **Password:** `admin123`

> ⚠️ **Note:** These are hardcoded for development only. Change them in `src/config/system-admin.json` before production deployment.

### Tenant User Login
**URL:** `http://localhost:5174/`

**Purpose:** Tenant workspace access (currently under development)

**Status:** Not yet available — platform setup required

---

## First Time Setup

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Admin Dashboard:**
   - Go to `http://localhost:5174/admin-setup`
   - Login with default credentials above

3. **Initialize Database:**
   - Click "Run Setup Wizard" on the Overview page
   - Follow the 3-step wizard:
     1. Review Firebase config
     2. Test connection
     3. Initialize database (creates collections + seeds default data)

4. **Verify Setup:**
   - After setup, you'll see the redesigned Overview page
   - Check the "Database Objects" card for collection status
   - Navigate to "Logs" tab to view system activity

---

## Key Features

### Overview Dashboard
- System health status
- Database connection status
- Module count and configuration
- Setup checklist with progress tracking
- Recent activity feed
- Platform information

### Logs Viewer
- **System Logs Tab:** Level, Time, Source, User, Message, Result
- **API Logs Tab:** Method, URL, Status Code, Response Time, Payloads
- Real-time filtering and search
- Detail panel for log inspection

### Database Setup Wizard
- Progress bar with step-by-step initialization
- Automatic schema creation from `database-schema.json`
- Seed data from `default-data.json` with bcrypt password hashing
- Comprehensive error handling

---

## Project Structure

```
src/
├── config/              # Configuration files
│   ├── app.json         # App metadata
│   ├── firebase.json    # Firebase config
│   ├── database-schema.json  # Firestore structure
│   ├── default-data.json     # Seed data
│   └── system-admin.json     # Admin credentials
├── core/                # Core app logic
│   ├── App.jsx          # Main orchestrator
│   ├── PlatformDashboard.jsx  # Admin dashboard
│   ├── auth/            # Authentication
│   ├── setup/           # Database setup wizard
│   └── views/           # Feature pages (Logs, etc.)
├── shared/              # Reusable components & services
│   ├── components/      # UI components
│   ├── layouts/         # Layout components (AppShell, TopNav, SideNav)
│   ├── services/        # Logger, AuthService
│   └── index.js         # Barrel export
└── modules/             # Future feature modules
```

---

## Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code (if configured)
npm run lint
```

---

## Architecture Highlights

### Authentication
- System Admin: JSON-based auth (`config/system-admin.json`)
- Tenant Users: Firebase Auth (future)
- Passwords: bcrypt hashing (never stored in plain text)

### Logging
- Centralized Logger service with configurable levels
- In-memory buffer for instant access
- Batch flush to Firestore (minimizes costs)
- User context tracking (`Logger.setUser()`)
- API call tracking with payloads

### Database
- Firestore structure defined in `database-schema.json`
- Root document: `platforms/knowvana`
- Collections: SystemAdmins, SystemLogs, SystemConfig, Tenants, etc.
- Seed data from `default-data.json`

---

## Troubleshooting

### Dev server won't start
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install
npm run dev
```

### Firebase connection fails
- Verify `src/config/firebase.json` has correct project ID
- Check Firebase project is active and Firestore is enabled
- Ensure network connectivity

### Database setup fails
- Check browser console for detailed error messages
- Verify Firestore rules allow writes from your IP
- Ensure all required fields in `default-data.json` are present

---

## Next Steps

- [ ] Customize admin credentials in `src/config/system-admin.json`
- [ ] Configure Firebase project URL in `src/config/firebase.json`
- [ ] Implement tenant management features
- [ ] Set up Firebase Auth for tenant login
- [ ] Build module registry for pluggable features
- [ ] Deploy to production

---

## Support

For issues or questions:
- Check the browser console (F12) for error messages
- Review logs in the Logs Viewer page
- Check `src/config/` files for configuration issues
- Refer to Firebase documentation: https://firebase.google.com/docs

---

**Last Updated:** February 24, 2026
**Version:** 1.0.0
