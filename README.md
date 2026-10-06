# Eventora

Eventora is a modern event management platform designed to streamline event organization, attendee management, and ticketing.

---

## 📁 Project Structure

```text
eventora/
├── backend/          # NestJS REST API with Prisma ORM & PostgreSQL
├── frontend/         # React SPA powered by Vite (upcoming)
├── .gitignore        # Root Git ignore rules
└── README.md         # Project documentation
```

---

## 🛠️ Tech Stack

### Backend
- **Framework:** [NestJS](https://nestjs.com/)
- **Language:** TypeScript
- **Database & ORM:** PostgreSQL, [Prisma ORM](https://www.prisma.io/)
- **Authentication:** JWT, Refresh Token Rotation, Argon2 password hashing
- **Testing:** [Vitest](https://vitest.dev/)
- **Linter & Formatter:** Oxlint, Prettier

### Frontend (Upcoming)
- **Framework:** [React](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Language:** TypeScript / JavaScript

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database
- [npm](https://www.npmjs.com/) (or yarn / pnpm)

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy the example environment file and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```

4. **Run database migrations / generate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Start the development server:**
   ```bash
   npm run start:dev
   ```

The backend server will run by default at `http://localhost:3000`.

---

## 🧪 Running Tests

To run the backend tests:
```bash
cd backend
npm run test
```

For end-to-end tests:
```bash
npm run test:e2e
```

---

## 📝 License

This project is private and unlicensed.
