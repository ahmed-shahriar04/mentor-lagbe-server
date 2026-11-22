# MentorLagbe Server - Backend API

MentorLagbe is an EdTech tuition management & mentorship backend built with Express.js, MongoDB, Better Auth JWKS verification, and Stripe Checkout.

## 🚀 Key Features
- **Better Auth & JWKS Integration:** Secure token validation using Better Auth public JWKS keys (`/api/auth/jwks`).
- **Role-Based Authorization Middlewares:** `verifyToken`, `verifyStudent`, `verifyTutor`, `verifyAdmin`.
- **Server-Side Search & Filter:** Dynamic search by tuition title/subject, and filter by class level, subject, and mode (Online/Offline).
- **Server-Side Pagination:** MongoDB `.skip()` and `.limit()` with total page calculation.
- **Stripe Checkout & Webhook:** Pro subscription upgrades for Tutors ($15) and Students ($10).
- **Tutor Quota Enforcer:** Free tutors can post up to 2 tuitions; Pro tutors post unlimited.
- **Student Quota Enforcer:** Free students can bookmark up to 5 tuitions; Pro students bookmark unlimited.
- **Application Workflow:** Role-restricted application system (students apply, tutors accept/reject).
- **Admin Moderation & Statistics:** Tuition approval/rejection, user role updates, and Stripe revenue reporting.
- **Seeding:** Pre-configured with 12 realistic approved tuition batches, tutors, and applications.

## 🛠️ Tech Stack & NPM Packages
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Database:** MongoDB Native Driver
- **Authentication:** `jose` (JWT / JWKS verification)
- **Payment:** `stripe`
- **Utilities:** `cors`, `dotenv`

## 🔐 Environment Variables (.env)
Create a `.env` file in the `server` root directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=mentorlagbe
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=super_secret_jwt_key_mentorlagbe_2026
```

## 📦 Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Seed the database with realistic data:
   ```bash
   npm run seed
   ```
3. Start the server:
   ```bash
   npm run dev
   # or
   npm start
   ```
4. Health check:
   ```
   http://localhost:5000/api/health
   ```


## 🔑 Test Credentials (Quick Evaluation)
- **Admin Email:** `shahriarahmedriaz_admin@mentrolagbe.com`
- **Admin Password:** `mentrolagbe_passDeboNa`
- **Tutor Email:** `shahriarahmedriaz.tutor@mentorlagbe.com`
- **Tutor Password:** `riaz_KI_mentor?`
- **Live Client URL:** [https://mentor-lagbe-naki.vercel.app/](https://mentor-lagbe-naki.vercel.app/)
