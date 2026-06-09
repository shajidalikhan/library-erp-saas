# Mobile app setup

The `mobile/` package is the React Native CLI foundation for the Library ERP SaaS. It mirrors the web client auth contract and is ready for feature modules without shipping ERP screens yet.

## Stack

- React Native CLI (0.85)
- TypeScript
- React Navigation (auth stack, app stack, bottom tabs)
- NativeWind + Tailwind CSS
- Zustand (auth persistence)
- React Query
- Axios (Bearer tokens + refresh flow)
- React Hook Form + Zod
- React Native Reanimated + Gesture Handler
- react-native-size-matters (phone + tablet scaling)

## Prerequisites

- Node.js 22+
- Android Studio with SDK 35+ and an emulator or device
- Xcode 16+ on macOS for iOS builds
- Running backend API at `http://localhost:5000/api/v1`

## Install

```bash
cd mobile
npm install
```

### iOS pods

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

## Run

Start Metro:

```bash
npm start
```

Android (emulator uses `10.0.2.2` for host `localhost`):

```bash
npm run android
```

iOS:

```bash
npm run ios
```

## API base URL

`src/config/env.ts` points development builds to `http://10.0.2.2:5000/api/v1` on Android emulators. For a physical device, replace the host with your machine LAN IP. Production builds should point to the deployed API host.

## Architecture

```text
mobile/
  src/
    components/ui/     Reusable UI primitives
    config/            Environment config
    constants/         Route names
    hooks/             Auth + responsive helpers
    lib/               Axios, token storage, query client
    modules/auth/      Auth service + validation
    navigation/        Root, auth, app, and tab navigators
    screens/           Splash, Login, Forgot Password, Dashboard
    store/             Zustand auth store
    theme/             Light/dark-ready theme tokens
    types/             Shared API and auth types
    utils/             Responsive scaling helpers
```

## Auth flow

1. Splash restores persisted tokens from AsyncStorage.
2. `GET /auth/me` validates the session when tokens exist.
3. Axios attaches `Authorization: Bearer <accessToken>`.
4. On `401`, the client calls `POST /auth/refresh` once and retries.
5. Failed refresh clears storage and returns the user to the auth stack.

## Quality checks

```bash
npm run typecheck
npm test
```

## Next steps

- Add feature modules under `src/modules/<feature>/` with their own services, screens, and navigation entries.
- Keep tenant-scoped API calls aligned with backend RBAC and `libraryId` / `branchId` rules.
- Extend the bottom tab navigator when operational modules are ready.
