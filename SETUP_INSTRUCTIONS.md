# BloodLink Setup Instructions 🩸

Follow these steps to set up and run the BloodLink project on your local machine.

## 1. Prerequisites
Ensure you have the following installed:
- **Node.js**: [Download and install Node.js](https://nodejs.org/) (Recommended: LTS version).
- **PostgreSQL**: [Download and install PostgreSQL](https://www.postgresql.org/download/).

## 2. Database Configuration
1. Open your PostgreSQL terminal (psql) or a tool like pgAdmin.
2. Create a new database named `bloodlink`:
   ```sql
   CREATE DATABASE bloodlink;
   ```
3. Ensure your PostgreSQL user has a password (default in the project is `admin123`).

## 3. Environment Setup
1. Look for the `.env` file in the project root. If it doesn't exist, create one.
2. Ensure it contains the following variables (adjust the `DATABASE_URL` if your password or port is different):
   ```env
   DATABASE_URL=postgresql://postgres:admin123@localhost:5432/bloodlink
   PORT=5000
   NODE_ENV=development
   SESSION_SECRET=bloodlink-dev-secret-123
   ```

## 4. Install Dependencies
Open your terminal in the project root directory and run:
```bash
npm install
```

## 5. Initialize Database Schema
Sync the Drizzle schema with your local database:
```bash
npm run db:push
```

## 6. Run the Application
Start the development server (this serves both the backend API and the frontend):
```bash
npm run dev
```
Once started, you can access the app at:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🛠️ Common Commands

| Command | Description |
| --------- | ----------- |
| `npm run dev` | Starts server + Vite in watch mode |
| `npm run db:push` | Syncs schema changes to database |
| `npm run db:studio`| Opens Drizzle Studio (web UI for DB) |
| `npm run build` | Builds the production version |

## ❗ Troubleshooting
- **Database Connection Error**: Double-check your `DATABASE_URL` in `.env` and ensure PostgreSQL is running.
- **Node Modules Error**: If you see errors related to `native modules` or `connect-pg-simple`, try deleting `node_modules` and running `npm install` again.
