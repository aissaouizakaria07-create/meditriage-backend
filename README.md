# MediAssist AI — Backend

Node.js + Express + MongoDB backend for the MediAssist AI frontend.

## What this backend does

| Problem in original file | Fix in this backend |
|---|---|
| Anthropic API key exposed in frontend JS | All Claude calls go through `/api/chat` (server-side proxy) |
| Passwords stored in plain text in localStorage | bcryptjs hashing (12 rounds) + MongoDB |
| No real JWT auth | JWT signed with strong secret, stored in **HttpOnly cookie** |
| Share links were just `window.location.href` | UUID-based `/api/chat/share/:uuid` with enable/disable toggle |
| Image analysis was a fake hardcoded reply | Real Claude Vision API call via `/api/chat/image` |
| History/reminders/mood in localStorage only | All saved to MongoDB, synced on login |

---

## Setup

### 1. Prerequisites
- Node.js ≥ 18
- MongoDB running locally **or** a free MongoDB Atlas cluster

### 2. Install dependencies
```bash
cd meditriage-backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Then edit .env with your values:
```

Required values in `.env`:
```
MONGO_URI=mongodb://127.0.0.1:27017/meditriage
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ANTHROPIC_API_KEY=sk-ant-api03-...
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:5000
```

### 4. Start the server
```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000`

---

## API Routes

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register with name, email, password |
| POST | `/api/auth/login` | Login with email, password |
| POST | `/api/auth/guest` | Get a 24h guest token |
| POST | `/api/auth/logout` | Clear the cookie |
| GET  | `/api/auth/me` | Get current user (requires auth) |

### Chat (requires auth)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat` | Send message to Claude |
| POST | `/api/chat/image` | Send image to Claude Vision |
| POST | `/api/chat/share` | Toggle share on/off for a chat |
| GET  | `/api/chat/share/:shareId` | Public read-only view (no auth needed) |
| GET  | `/api/chat/history` | Get last 50 conversations |
| POST | `/api/chat/history` | Save/update a conversation entry |

### Profile (requires auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/profile` | Get health profile |
| PUT | `/api/profile` | Update health profile |

### Reminders (requires auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/reminders` | List all reminders |
| POST   | `/api/reminders` | Add a reminder |
| PATCH  | `/api/reminders/:id/toggle` | Toggle active/inactive |
| DELETE | `/api/reminders/:id` | Delete a reminder |

### Mood (requires auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET  | `/api/mood` | Get last 90 mood entries |
| POST | `/api/mood` | Add a mood entry |

---

## Frontend setup

In `mediassist_ai_fixed.html`, there is one line at the top of the JS:

```js
const API = 'http://localhost:5000/api';
```

Change this to your deployed backend URL when going to production.

---

## Production deployment

### Recommended: Railway or Render
1. Push this folder to GitHub
2. Create a new Web Service on Railway/Render
3. Add all `.env` variables in the dashboard
4. The server will auto-detect `NODE_ENV=production` and serve the frontend from `public/`

To serve the frontend from the backend:
1. Put `mediassist_ai_fixed.html` in a `public/` folder
2. Rename it to `index.html`
3. Set `NODE_ENV=production`

---

## Security notes
- JWT stored in HttpOnly cookie → not accessible to JavaScript → XSS-safe
- Rate limiting on all routes (200/15min general, 20/15min auth, 15/min chat)
- Anthropic API key never sent to the browser
- bcrypt with 12 rounds on all passwords
- CORS restricted to `CLIENT_URL` only
