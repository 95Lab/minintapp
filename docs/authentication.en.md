# Supabase sign-in and registration

Supabase verifies email identity only. PostgreSQL continues to store platform metadata and app data; enabling accounts does not require `APP_STORAGE=supabase`.

## Environment

The single source is `/root/.config/ai-secrets/api.env` on the server. Compose injects `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into the Control Plane. URLs must identify the same project, with an anon/publishable public key. No service-role, OpenAI, or Cloudflare key is injected into sandboxes. The Control Plane signs sessions with the existing `IP_HASH_SALT`; enabling Auth does not change its signing key.

## Supabase Dashboard configuration

In Authentication → URL Configuration, set Site URL to `https://minintapp.io.vn` and add Redirect URL `https://minintapp.io.vn/auth/callback**` (including the PKCE query). Preserve other products’ redirect URLs if the project is shared. Enable the email provider and new signups. Configure custom SMTP for users outside the organization if Supabase’s default email service restricts recipients.

## User flow

1. Open `/login` and enter an email. New emails register automatically; existing emails sign in, without passwords.
2. The server requests a Supabase magic link and sets an HttpOnly/Secure PKCE cookie in this browser. Open the email in the same browser. Resending replaces the old verifier.
3. The callback accepts only an authorization code, removes query/fragment from the address bar, and exchanges it server-side using the signed verifier. Arbitrary access tokens are rejected. Access/refresh tokens are never returned to the browser or stored in localStorage.
4. The server issues a `__Host-minint_session` cookie on HTTPS for up to 30 days. Sign-out clears the local session; it does not claim to revoke all Supabase sessions on other devices.
5. Apps created after sign-in belong to the user ID. Anonymous RUNNING apps controlled by the tenant cookie or a valid host token can be claimed; other users’ apps cannot be transferred. Pending apps can be claimed once RUNNING.

Link requests and code exchanges are rate limited. Delivery errors return a generic response without provider details or keys. Supabase accepting a request does not prove inbox delivery; the recipient must confirm it.

## Verification

Unit tests cover PKCE cookies, expiry/tampering, sessions/logout, auth-only configuration, and actual SDK challenge/verifier behavior with mocked transport. E2E covers the form, callback, and claiming. Live checks use the real project without printing tokens; temporary identities are deleted. Real email is sent only to the address designated by the owner.

References: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless).
