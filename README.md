# Remote Desktop Application

Campus is a browser-based desktop OS — you log in and get a real Windows/macOS-style desktop running entirely inside a webpage, with draggable icons, resizable windows, a taskbar, a start menu, and an AI assistant with actual control over your workspace.

A full-stack web application built with a modern JavaScript stack, combining a frontend client with a secure Node.js/Express backend and PostgreSQL database.

The project is designed around a personal workspace/file-system experience with authentication, folders and files, uploads, search, trash/restore, access control, and a clean service-based backend architecture.


> **Status:** Active development
> **Live URL:** [https://campus26.netlify.app/](https://campus26.netlify.app/)

---

## ✨ Features

### 🔐 Authentication & Security

- User registration and login
- Short-lived JWT access tokens
- Secure refresh-token sessions
- Refresh-token rotation and reuse detection
- HTTP-only cookies for refresh tokens
- Password hashing with `bcryptjs`
- Account lockout after repeated failed logins
- Authentication middleware
- Role-based authorization
- Request validation with Zod
- Security headers with Helmet
- CORS protection
- API rate limiting
- Centralized error handling

### 📁 File & Folder Management

- Create folders
- Create text files
- Upload files
- Rename files and folders
- Move items between folders
- Duplicate files
- Browse complete folder trees
- Breadcrumb/path resolution
- Search files and folders
- Workspace statistics
- File downloads

### 🗑️ Trash System

The application uses a soft-delete system rather than immediately deleting records.

- Move files/folders to trash
- Cascade trash operations through folders
- Restore deleted items
- Restore folder hierarchies
- Restore items to their original parent when possible
- Permanently delete trashed items
- Empty the entire trash

### 🛡️ Data Isolation

Every node belongs to an authenticated owner.

Backend operations verify ownership before reading or modifying data, preventing users from accessing another user's files through direct API requests.

### 🧱 Backend Architecture

The backend follows a layered architecture:

```text
Request
   ↓
Route
   ↓
Middleware
   ↓
Controller
   ↓
Service
   ↓
Prisma
   ↓
PostgreSQL
```

Controllers are intentionally kept thin. Business logic and database operations live inside services.

---

# 🏗️ Project Structure

```text
remote-desktop-application/
│
├── app/                         # Frontend application
│   ├── ...
│   └── ...
│
├── backend/                     # Node.js backend
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── env.js
│   │   │   └── logger.js
│   │   │
│   │   ├── constants/
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   └── node.controller.js
│   │   │
│   │   ├── middlewares/
│   │   │   ├── authenticate.middleware.js
│   │   │   ├── authorize.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   ├── rateLimiters.js
│   │   │   ├── upload.middleware.js
│   │   │   └── validate.middleware.js
│   │   │
│   │   ├── routes/
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── audit.service.js
│   │   │   ├── node.service.js
│   │   │   ├── storage.service.js
│   │   │   └── token.service.js
│   │   │
│   │   ├── utils/
│   │   │
│   │   ├── validators/
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── package.json
│   └── ...
│
├── .gitignore
├── netlify.toml
└── README.md
```

---

# 🧰 Tech Stack

## Frontend

- Next.js
- React
- JavaScript
- Zustand
- Axios

The frontend keeps a local representation of the workspace tree for fast synchronous access while mutations are synchronized with the backend.

## Backend

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- Zod
- JWT
- bcryptjs
- Multer
- ImageKit
- Helmet
- CORS
- express-rate-limit

## Database

PostgreSQL is used as the primary persistent database.

Prisma provides:

- Schema management
- Database access
- Type-safe queries
- Migrations
- Recursive raw SQL where tree operations require it

---

# 🚀 Getting Started

## Prerequisites

Install:

- Node.js 18+
- npm
- PostgreSQL
- Git

You can verify Node.js with:

```bash
node --version
```

---

# 1. Clone the Repository

```bash
git clone https://github.com/bachansingh1407/remote-desktop-application.git
cd remote-desktop-application
```

---

# 2. Backend Setup

```bash
cd backend
npm install
```

Create an environment file:

```text
.env
```

Example configuration:

```env
NODE_ENV=development

PORT=5000
API_PREFIX=/api

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"

ACCESS_TOKEN_SECRET="your-long-random-secret"
ACCESS_TOKEN_EXPIRES_IN="15m"

REFRESH_TOKEN_EXPIRES_DAYS=30

CORS_ORIGIN="http://localhost:3000"

UPLOAD_DIR="uploads"
```

> Never commit `.env` files or production secrets to GitHub.

Generate Prisma Client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

Optional seed:

```bash
npm run prisma:seed
```

Start the backend:

```bash
npm run dev
```

The API normally runs at:

```text
http://localhost:5000
```

Health check:

```text
GET /api/health
```

---

# 3. Frontend Setup

Open another terminal:

```bash
cd app
npm install
```

Create the frontend environment file if required by the application.

For example:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend normally runs at:

```text
http://localhost:3000
```

---

# 🔌 API Overview

All API endpoints are prefixed with `/api`.

## Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user |
| POST | `/auth/change-password` | Change password |

## Files & Folders

All node endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/nodes/tree` | Get complete workspace tree |
| GET | `/nodes` | List folder children |
| GET | `/nodes/trash` | List trash |
| DELETE | `/nodes/trash/empty` | Empty trash |
| GET | `/nodes/search` | Search nodes |
| GET | `/nodes/stats` | Workspace statistics |
| POST | `/nodes/folder` | Create folder |
| POST | `/nodes/file` | Create text file |
| POST | `/nodes/import` | Upload a file |
| GET | `/nodes/:id/path` | Get node path |
| GET | `/nodes/:id/download` | Download file |
| PATCH | `/nodes/:id/content` | Update file content |
| PATCH | `/nodes/:id/rename` | Rename node |
| PATCH | `/nodes/:id/move` | Move node |
| POST | `/nodes/:id/duplicate` | Duplicate node |
| POST | `/nodes/:id/trash` | Move node to trash |
| POST | `/nodes/:id/restore` | Restore node |
| DELETE | `/nodes/:id` | Permanently delete node |

---

# 🌳 File-System Model

Files and folders are represented by a single `Node` model.

Conceptually:

```text
Workspace
│
├── Documents
│   ├── Resume.pdf
│   ├── Notes.txt
│   └── Projects
│       └── Project.md
│
├── Images
│   └── photo.png
│
└── Videos
    └── demo.mp4
```

Each node contains a `parentId`.

A root-level item has:

```text
parentId = null
```

Folders can therefore contain unlimited nested files and folders.

---

# 🔄 Tree Operations

Operations involving nested folders use recursive database queries where appropriate.

For example, deleting:

```text
Documents/
├── Work/
│   ├── project.pdf
│   └── notes.txt
└── personal.txt
```

moves the complete subtree into the trash.

The backend calculates the subtree using a PostgreSQL recursive CTE rather than repeatedly querying each child from JavaScript.

This keeps tree operations efficient and avoids an N+1 query pattern.

---

# 🗑️ Trash Semantics

The application separates **trash** from **permanent deletion**.

### Move to trash

```text
POST /api/nodes/:id/trash
```

The node and its descendants become trashed.

### Restore

```text
POST /api/nodes/:id/restore
```

The backend attempts to restore the original hierarchy.

### Permanent deletion

```text
DELETE /api/nodes/:id
```

Permanent deletion is only allowed for items already in the trash.

### Empty trash

```text
DELETE /api/nodes/trash/empty
```

Permanently removes all trashed nodes belonging to the authenticated user.

---

# 🔐 Authentication Architecture

The application uses two token mechanisms.

### Access Token

A short-lived JWT is used to authenticate API requests:

```http
Authorization: Bearer <access-token>
```

### Refresh Token

Refresh tokens are opaque random values rather than JWTs.

The server stores a SHA-256 hash of the refresh token and sends the raw token through an HTTP-only cookie.

The system supports:

- Rotation
- Revocation
- Token families
- Reuse detection
- Session invalidation

This reduces the impact of refresh-token theft and avoids storing reusable refresh credentials directly in the database.

---

# 🛡️ Security

The backend includes several security layers:

```text
Authentication
      ↓
Authorization
      ↓
Input Validation
      ↓
Rate Limiting
      ↓
Business Rules
      ↓
Ownership Checks
      ↓
Database
```

Important protections include:

- Password hashing
- JWT validation
- Refresh-token rotation
- HTTP-only cookies
- CORS
- Helmet
- Rate limiting
- Zod validation
- Owner-based database queries
- Centralized error handling
- Soft-delete rules
- Folder cycle prevention

---

# 🧪 Development Commands

From `backend/`:

```bash
npm run dev
```

Start production server:

```bash
npm start
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create/apply development migration:

```bash
npm run prisma:migrate
```

Deploy migrations:

```bash
npm run prisma:migrate:deploy
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

Run database seed:

```bash
npm run prisma:seed
```

---

# 🌐 Deployment

The project can be deployed as separate frontend and backend services.

A typical architecture is:

```text
                         ┌─────────────────┐
                         │    Browser      │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Next.js /       │
                         │ Frontend        │
                         └────────┬────────┘
                                  │ HTTPS
                                  ▼
                         ┌─────────────────┐
                         │ Express API     │
                         │ Backend         │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             ┌──────────────┐           ┌──────────────┐
             │ PostgreSQL   │           │ File Storage │
             │ + Prisma     │           │ / ImageKit  │
             └──────────────┘           └──────────────┘
```

For production:

- Use HTTPS
- Use strong random secrets
- Restrict CORS to the frontend domain
- Use a managed PostgreSQL database
- Use external object/file storage for scalable deployments
- Never expose `.env` files
- Run Prisma migrations during deployment

---

# 📦 File Storage

The application supports uploaded files through the storage service.

For development, local disk storage can be used.

For production, external object storage is recommended because application servers are generally not a reliable place for persistent user uploads.

Possible production storage providers include:

- ImageKit
- Cloudflare R2
- Amazon S3
- Other S3-compatible object storage

---

# 🧠 Design Principles

The project follows a few important principles:

### 1. Keep controllers thin

Controllers handle HTTP concerns.

```text
Controller → Service
```

Business logic should not be scattered throughout route handlers.

### 2. Keep database access centralized

Services are responsible for Prisma/database operations.

### 3. Validate at the API boundary

Incoming request data is validated before reaching business logic.

### 4. Treat ownership as a security boundary

Every file/folder operation is scoped to the authenticated user.

### 5. Prefer reversible operations

Files are moved to trash before permanent deletion.

### 6. Avoid unnecessary frontend/backend duplication

The frontend maintains a local workspace cache for fast UI reads while the backend remains the source of truth.

---

# 🛠️ Current Scope

The current project focuses on:

- Authentication
- User sessions
- File/folder management
- Workspace tree
- File uploads
- Search
- Trash and restore
- File downloads
- Workspace statistics
- Secure API architecture
- PostgreSQL persistence

---

# 🔮 Possible Future Improvements

Potential future additions include:

- Real-time synchronization
- WebSocket support
- Collaborative editing
- File previews
- Version history
- Sharing and permissions
- Public/private links
- Object storage with Cloudflare R2
- Background processing for large uploads
- Full-text search
- Activity/audit dashboard
- Desktop client
- Remote desktop/control features
- Multi-device synchronization

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/my-feature
```

3. Make your changes
4. Commit them

```bash
git commit -m "Add my feature"
```

5. Push the branch

```bash
git push origin feature/my-feature
```

6. Open a Pull Request

---

# 📄 License

This project currently does not specify a public license.

If you plan to allow others to reuse, modify, or distribute the code, add an appropriate `LICENSE` file.

---

## 👨‍💻 Author

**Bachan Singh**

GitHub:  
https://github.com/bachansingh1407

Repository:  
https://github.com/bachansingh1407/remote-desktop-application
