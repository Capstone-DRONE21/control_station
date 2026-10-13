# Frontend

Run `npm run dev` from the repository root to start the frontend and backend.

## Structure

- `src/App.tsx`: session bootstrap and authentication-dependent navigation.
- `src/features/auth/api.ts`: authentication requests and operator type.
- `src/pages/login/`: login form and its styles.
- `src/pages/dashboard/`: authenticated dashboard and its styles.
- `src/components/farm/`: shared 3D scene and environment.
- `src/styles/global.css`: application-wide defaults.
- `public/models/`: 3D model assets served at `/models/`.
- `tests/`: authentication API tests using Node's test runner.

Successful login opens `/dashboard`. Reloading checks the server session before
showing protected content. Anonymous visitors are sent to `/login`; signing out
returns there after the server confirms logout. The dashboard currently displays a centered heading and a logout button. Backend endpoints must enforce their
own authentication; frontend navigation is not an authorization boundary.

Production hosting must serve `index.html` for `/login` and `/dashboard` and proxy
`/api` to the backend. Vite handles these paths in development.

## Checks

From the repository root:

```sh
npm run build
npm run lint
node --experimental-strip-types --test frontend/tests/auth.test.mjs
```
