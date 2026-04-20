
User wants ONLY the Secretária IA backend URL behavior confirmed/configured via `VITE_AI_BACKEND_URL`, without touching Supabase config or any other module.

Looking at `src/lib/aiBackend.ts`:
- It already reads `VITE_AI_BACKEND_URL` from env, with a hardcoded Cloudflare tunnel fallback that's dead.
- The fallback is the source of the "Failed to fetch" error when the env var isn't set.

The minimal, surgical change is:
1. Remove the dead Cloudflare tunnel fallback so behavior is predictable.
2. When `VITE_AI_BACKEND_URL` isn't configured, throw a clear, friendly error in the UI instead of silently calling a dead URL.
3. Show a subtle "backend não configurado" hint in `SecretariaIA.tsx` status card when the var is missing.

Nothing else changes. Supabase client, .env Supabase keys, agenda, pacientes, financeiro, auth, dashboard — all untouched.

Plan is small, no questions needed.
