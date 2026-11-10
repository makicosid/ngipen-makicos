# NGIPEN Firebase Cloud Messaging Setup

This integration uses Firebase Cloud Messaging for browser push and the existing NGIPEN cookie session for API authentication.

## Environment variables

Add these only to a local, untracked `.env.local` for local testing. Do not commit real values.

### Public Firebase Web configuration
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### Server-only Firebase Admin credentials
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Store the service-account private key only in server-side environment variables. For multiline values, preserve newlines or use escaped \\n sequences. Never put service-account JSON or private keys in the repository, browser bundle, service worker, or chat.

Existing Supabase variables are reused:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Dependencies

Install:
```bash
npm install firebase@^11.10.0 firebase-admin@^13.4.0
```

Commit the generated `package-lock.json` after verifying `npm ci` locally. Do not hand-edit the lockfile.

## Browser requirements

- HTTPS (localhost is permitted for development).
- Browser notification and service-worker support.
- User gesture required for requesting notification permission.
- Firebase Cloud Messaging API (V1) enabled in the Firebase project.

## API

- `POST /api/push/subscription`: register or refresh the current user's FCM token.
- `DELETE /api/push/subscription`: deactivate the current user's token.
- `POST /api/push/test`: send a test notification to the current user's active registered devices.

All endpoints require the existing authenticated NGIPEN user session. No SQL migration is performed by this feature.

## Supabase table contract

The API expects the already-created `public.push_subscriptions` table with columns:
`id,user_id,fcm_token,device_label,platform,is_active,updated_at,last_seen_at,invalidated_at`.
The API uses the existing unique constraint on `fcm_token` for upsert. It does not create or alter tables, policies, grants, or functions.

## Testing

1. Configure local environment variables.
2. Run `npm install` then `npm ci` after lockfile generation.
3. Run `npm run build`.
4. Log in as a normal NGIPEN user on localhost.
5. Use the attendance panel's notification activation action.
6. Confirm the device row appears in `push_subscriptions`.
7. Trigger the test notification and confirm it appears on the device.
8. Verify that a different user's session cannot register or deactivate another user's token.

The reminder worker and scheduled delivery are intentionally outside this integration stage.
