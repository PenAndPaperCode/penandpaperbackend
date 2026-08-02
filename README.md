# pen-and-paper-backend

Serverless backend for [PenAndPaper](https://penpaperpreparation.com) — the interview prep app.

**Stack:** AWS Lambda · API Gateway · DynamoDB · Node.js 18 · Serverless Framework

---

## Architecture

```
Frontend (Next.js)
    │
    │  Google ID Token
    ▼
POST /auth/google          ← verifies token with Google, upserts user, returns JWT
    │
    │  Bearer JWT on every subsequent request
    ▼
GET  /users/me             ← user profile
POST /progress/mark        ← mark a problem done/undone
GET  /progress             ← full doneStatus map (drop-in replacement for localStorage)
GET  /progress/stats       ← total solved, by category, last activity
```

---

## DynamoDB Tables

### `pen-and-paper-users-{stage}`
| Attribute   | Type   | Key        |
|-------------|--------|------------|
| userId      | String | PK (Hash)  |
| googleId    | String | GSI Hash   |
| email       | String |            |
| name        | String |            |
| picture     | String |            |
| createdAt   | String |            |
| lastLoginAt | String |            |

GSI: `googleId-index` — used to look up a user by their Google sub on login.

### `pen-and-paper-progress-{stage}`
| Attribute   | Type   | Key        |
|-------------|--------|------------|
| userId      | String | PK (Hash)  |
| problemKey  | String | SK (Range) |
| category    | String |            |
| topic       | String |            |
| subtopic    | String |            |
| problemName | String |            |
| isDone      | Boolean|            |
| updatedAt   | String |            |

`problemKey` matches exactly the key format the frontend uses in `doneStatus`:  
`"DSA_Binary Search_basics_Search Insert Position"`

---

## Setup

### 1. Install dependencies
```bash
cd pen-and-paper-backend
npm install
```

### 2. Create your `.env` file
```bash
cp .env.example .env
# Fill in JWT_SECRET with a strong random value:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Deploy to AWS
```bash
# Development
npm run deploy

# Production
npm run deploy:prod
```

After deploy, Serverless prints the API Gateway base URL:
```
endpoints:
  POST - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/auth/google
  GET  - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/users/me
  POST - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/progress/mark
  GET  - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/progress
  GET  - https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/dev/progress/stats
```

### 4. Run locally
```bash
npm start   # starts serverless-offline on http://localhost:3001
```

---

## API Reference

### `POST /auth/google`
```json
// Request
{ "idToken": "<Google ID token from frontend>" }

// Response 200
{
  "success": true,
  "token": "<JWT>",
  "user": { "userId": "...", "email": "...", "name": "...", "picture": "..." }
}
```

### `GET /users/me`
```
Authorization: Bearer <JWT>
```
```json
{ "success": true, "user": { ... } }
```

### `POST /progress/mark`
```
Authorization: Bearer <JWT>
```
```json
// Request
{
  "problemKey":  "DSA_Binary Search_basics_Search Insert Position",
  "category":    "DSA",
  "topic":       "Binary Search",
  "subtopic":    "basics",
  "problemName": "Search Insert Position",
  "isDone":      true
}

// Response 200
{ "success": true, "problemKey": "...", "isDone": true, "updatedAt": "..." }
```

### `GET /progress`
```
Authorization: Bearer <JWT>
```
```json
{
  "success": true,
  "total": 42,
  "doneStatus": {
    "DSA_Binary Search_basics_Search Insert Position": true,
    "DSA_Array_advance_Rotate Array": true
  }
}
```

### `GET /progress/stats`
```
Authorization: Bearer <JWT>
```
```json
{
  "success": true,
  "total": 42,
  "byCategory": { "DSA": 28, "HLD": 5, "LLD": 4 },
  "lastActivity": "2026-08-01T12:00:00.000Z"
}
```

---

## Integrating with the Frontend

In `LoginButton.tsx`, after Google sign-in succeeds, call `/auth/google` with the `idToken` and store the returned JWT:

```ts
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken: response.credential }),
});
const { token, user } = await res.json();
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(user));
```

Then on app load, call `GET /progress` to hydrate `doneStatus` from the backend instead of only localStorage — giving users their progress on any device.
