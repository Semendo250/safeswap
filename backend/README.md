# SafeSwap Backend - Phase 1

Foundation: config, models, auth (signup with OTP verification and verification-path
branching, login).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your real values:
   - MongoDB Atlas connection string
   - A random JWT secret
   - Cloudinary credentials (needed from Phase 2 onward, for listing photos)
   - Gmail address + app password for sending OTP emails (Gmail requires an
     "app password", not your normal password - enable 2FA on the Gmail
     account first, then generate one under Google Account > Security)
3. `npm run dev` (requires nodemon, included in devDependencies)

## What's implemented

- `POST /api/auth/signup` - creates a user, detects university email vs
  fallback path automatically based on `ALLOWED_EMAIL_DOMAIN`, sends OTP
- `POST /api/auth/verify-otp` - confirms the OTP, marks emailVerified, returns
  a JWT
- `POST /api/auth/login` - standard login, blocks unverified/banned accounts

## What's next (Phase 2)

- Listings CRUD with category branching (phone vs general)
- IMEI validation wired into the listing controller (utils/imei.js is ready)
- Cloudinary photo upload middleware

## Notes for your project report

- OTP storage is currently in-memory (`utils/otp.js`) - fine for a demo, but
  flagged there as needing a persistent/TTL-indexed store before any real
  deployment.
- `verificationPath` auto-detects based on email domain at signup - students
  without an active university email fall through to `fallback` and will
  need `fallbackApproved` set by an admin (Phase 3) before their phone
  listings go live.
