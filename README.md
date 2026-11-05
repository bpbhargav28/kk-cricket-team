<div align="center">

# 🏏 KK CRICKET TEAM

**Organise matches, collect attendance votes, split expenses and track payments — for a group of friends who just want to play cricket on Sunday.**

A mobile-first React + TypeScript app that runs as a static site on GitHub Pages, with Supabase handling all data, authentication and realtime updates.

</div>

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Create a Supabase project](#1-create-a-supabase-project)
5. [Run the database migrations](#2-run-the-database-migrations)
6. [Configure Supabase authentication](#3-configure-supabase-authentication)
7. [Configure environment variables](#4-configure-environment-variables)
8. [Run it locally](#5-run-it-locally)
9. [Create the first admin account securely](#6-create-the-first-admin-account-securely)
10. [Deploy to GitHub Pages](#7-deploy-to-github-pages)
11. [How the expense split works](#how-the-expense-split-works)
12. [Dates and times](#dates-and-times)
13. [Security model](#security-model)
14. [Project structure](#project-structure)
15. [Scripts](#scripts)
16. [Demo data (development only)](#demo-data-development-only)
17. [Verifying the deployment](#verifying-the-deployment)
18. [Troubleshooting](#troubleshooting)

---

## What it does

| | Feature |
|---|---|
| 📊 | **Dashboard** — next match, ground, date and time, squad size, who is in and who is out, your share of the upcoming match, recent matches and anything you still owe |
| 🗓️ | **Matches** — admins publish a fixture (title, date, time, ground, description, total estimated expense, voting deadline); everyone sees it immediately |
| ✋ | **Attendance voting** — Yes / No / Maybe, one active vote per player, changeable until voting closes, with live results and names listed under each category |
| 💸 | **Automatic expense splitting** — total expense ÷ confirmed players, recalculated whenever attendance changes, with manual per-player adjustments and exemptions |
| 🧾 | **Payment tracking** — per player: amount due, amount paid, Pending / Partially paid / Paid, payment date; per match: total expense, collected, outstanding, counts |
| 📜 | **Match history** — every played match with attendance, total expense, per-player contribution and the collection summary |
| 🕵️ | **Audit trail** — every expense change, manual adjustment, exemption and payment is recorded with who did it and when |
| ⚡ | **Realtime** — votes, splits and payments update on everyone's screen without a refresh |

Everything is in **Indian Rupees (₹)**.

### Roles

**Admin** can create, edit, cancel and delete matches, set expenses, close and reopen voting, adjust individual contributions, exempt players, record payments and manage the squad.

**Player** can vote for attendance, change that vote until voting closes, see the confirmed squad, see their own contribution, and view their own payment history plus the overall match totals.

---

## Tech stack

- **React 18** + **TypeScript** + **Vite 5**
- **Tailwind CSS** (custom dark `coal` / green `pitch` cricket palette)
- **Supabase** — PostgreSQL, Auth, Realtime, Row Level Security
- **Lucide React** icons
- **React Router 6** (with a GitHub Pages SPA fallback so nested routes survive a refresh)
- **Vitest** for unit tests
- **GitHub Actions** → **GitHub Pages** for deployment

No backend server of your own, and no payment gateway — this is a payment *tracking* system.

---

## Quick start

```bash
git clone https://github.com/bpbhargav28/kk-cricket-team.git
cd kk-cricket-team
npm install
cp .env.example .env     # then fill in your Supabase URL + anon key
npm run dev
```

The app starts at **http://localhost:5173/kk-cricket-team/** (note the sub-path — it matches the GitHub Pages URL).

Until `.env` is filled in you will see a setup screen explaining exactly which variables are missing. The full setup is below.

**Prerequisites:** Node.js 20 or newer and npm 10+ (`node --version`).

---

## 1. Create a Supabase project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Pick a name (e.g. `kk-cricket-team`), set a strong database password (save it in a password manager — you will rarely need it), and choose the region closest to your team. For India, **South Asia (Mumbai) `ap-south-1`** gives the lowest latency.
3. Wait for provisioning (about two minutes).
4. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **Project API keys → `anon` / `publishable`** → this is `VITE_SUPABASE_ANON_KEY`

> ### ⚠️ About keys
> The **anon / publishable** key is *designed* to be public — it ends up in the JavaScript bundle of every Supabase app. It is safe here because every table is protected by Row Level Security.
>
> The **`service_role`** key is the opposite: it bypasses RLS completely. **Never** put it in `.env`, in any `VITE_*` variable, in a GitHub secret used by this build, or anywhere in this repository. Anything prefixed `VITE_` is inlined into the public bundle and is world-readable.

---

## 2. Run the database migrations

The three files in `supabase/migrations/` create everything: tables, indexes, constraints, triggers, views, RLS policies and the privileged functions. **Run them in filename order.**

### Option A — SQL editor (no tooling required)

1. Open **SQL Editor → New query** in the Supabase dashboard.
2. Paste the full contents of each file and click **Run**, one at a time, in this order:
   1. `supabase/migrations/20260101000000_initial_schema.sql`
   2. `supabase/migrations/20260101000100_row_level_security.sql`
   3. `supabase/migrations/20260101000200_functions.sql`
3. Each should finish with *Success. No rows returned*.

### Option B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### Verify

Run `supabase/tests/verify.sql` in the SQL editor. It asserts that all tables exist, that Row Level Security is enabled on every one of them, that the expected policies are in place, that `payments.status` is a generated column and that the privileged functions are `SECURITY DEFINER` with `EXECUTE` revoked from `anon`. It raises an exception on the first problem it finds and changes no data.

### What the schema looks like

| Table | Purpose | Key constraints |
|---|---|---|
| `profiles` | One row per user, mirroring `auth.users` | `role` is `admin` or `player`; a trigger blocks self-escalation |
| `matches` | Fixtures and their total expense | `status` upcoming / completed / cancelled; `voting_open`, `contributions_finalized` |
| `match_votes` | Attendance votes | `UNIQUE (match_id, player_id)` — one active vote per player per match |
| `match_expenses` | Optional expense line items | Categorised (ground, ball, kit, refreshments, umpire, travel, other) |
| `player_contributions` | What each player owes | `UNIQUE (match_id, player_id)`; `is_exempt`, `is_manual_override` |
| `payments` | What each player has paid | `UNIQUE (match_id, player_id)`; `status` is a **generated** column |
| `contribution_audit` | Append-only history of every money change | No client write policies at all |

Two aggregate views, `match_payment_summary` and `match_vote_summary`, let players see match-wide totals without seeing anyone else's individual payment rows.

---

## 3. Configure Supabase authentication

In **Authentication → Providers**, make sure **Email** is enabled (it is by default). No other provider is needed.

### Redirect URLs — the step people get wrong

The app is served from a **sub-path** (`/kk-cricket-team/`), and both the signup confirmation and the password-reset links must come back to that sub-path. In **Authentication → URL Configuration**:

**Site URL**

```
https://bpbhargav28.github.io/kk-cricket-team/
```

**Redirect URLs** (add every line):

```
https://bpbhargav28.github.io/kk-cricket-team/login
https://bpbhargav28.github.io/kk-cricket-team/reset-password
http://localhost:5173/kk-cricket-team/login
http://localhost:5173/kk-cricket-team/reset-password
```

These exact paths are what the app asks for — see `emailRedirectTo` and `redirectTo` in `src/context/AuthContext.tsx`. If a URL is not on the allow-list, Supabase silently falls back to the Site URL and the reset link will not work.

### Email confirmation

**Authentication → Providers → Email → Confirm email** is on by default.

- **Leave it on** if your team is spread out and you want verified addresses. New players must click a link in their inbox before they can sign in.
- **Turn it off** for a small group of friends who are signing up together — it removes a step and avoids the built-in SMTP rate limit (a handful of emails per hour). The trade-off is that nobody verifies the address, so a typo locks a player out of password resets.

The built-in email service is rate-limited and meant for development. If you expect more than a few signups a day, configure **custom SMTP** under **Project Settings → Auth → SMTP Settings**.

### Password policy

Under **Authentication → Policies**, set the minimum password length to **8** or more. The app validates 8+ characters with at least one letter and one number on the client; the server-side setting is what actually enforces it.

### Sessions

**Authentication → Settings → JWT expiry** defaults to 3600 s. Raising it to `86400` (a day) means the team signs in far less often; the client refreshes tokens automatically (`autoRefreshToken: true` in `src/lib/supabase.ts`), so either value works.

### Leave public signups enabled

**Authentication → Providers → Email → Enable sign ups** is on by default — keep it on. The app's `/signup` page depends on it, and the security model does not rely on signup being closed: a new account is always a `player`, every table is behind RLS, and an admin can deactivate anyone from the Players page. If you turn it off, the signup form breaks and you have to add each player by hand under **Authentication → Users**.

### Realtime

The migration already adds the relevant tables to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL` (needed for filtered subscriptions like `match_id=eq.…`, where Postgres has to send the whole old row for RLS to be evaluated on updates and deletes). Nothing extra needs enabling in the dashboard.

### Backups

Free-tier projects get daily backups kept for 7 days; Pro keeps 30 days and adds point-in-time recovery. Before any risky migration, take a manual copy from **Database → Backups → Download backup**.

---

## 4. Configure environment variables

```bash
cp .env.example .env
```

Then fill in:

```ini
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL from Settings → API |
| `VITE_SUPABASE_ANON_KEY` | yes | The **anon / publishable** key only |
| `VITE_BASE_PATH` | no | Defaults to `/kk-cricket-team/`. Set to `/` for a custom domain or a `<user>.github.io` repository |
| `VITE_ENABLE_DEMO_DATA` | no | `true` shows the dev-only demo badge. Ignored in production builds |

`.env` is git-ignored. **Never commit real secrets** — only `.env.example` is tracked.

---

## 5. Run it locally

```bash
npm run dev
```

Open **http://localhost:5173/kk-cricket-team/**, click **Create an account**, and sign up. The `handle_new_user()` trigger creates your `profiles` row automatically — always with the role `player`, never `admin`.

---

## 6. Create the first admin account securely

Everybody who signs up is a **player**. Someone has to become the first admin, and that is deliberately the one privileged action that cannot happen by accident.

### How it is protected

- A trigger (`guard_profile_privileges()`) rejects any attempt by a user to change their own `role` or `is_active`, so a player cannot promote themselves through the API.
- `promote_to_admin(p_email)` is a `SECURITY DEFINER` function that normally requires the caller to already be an admin (`assert_admin()`).
- The **one** exception is the bootstrap window: while **no active admin exists in the whole table**, a signed-in user may promote **only their own account** (the email must match the caller's). As soon as the first admin exists, the window closes permanently and only admins can promote anyone.

### Do this (recommended — SQL editor)

1. **Sign up normally** in the app with the email that should own the team.
2. In the Supabase dashboard, open **SQL Editor** and run:

   ```sql
   update public.profiles
      set role = 'admin'
    where lower(email) = lower('you@example.com');
   ```

   The dashboard SQL editor connects without an end-user JWT, so `auth.uid()` is `null` and the guard trigger treats the session as trusted. This is safe precisely because reaching that SQL editor already requires owning the Supabase project — there is no path to it from the web app.

3. Reload the app. You now see the admin navigation, the **New match** button and the admin controls on the Players page.
4. **Every later admin** is promoted from inside the app: **Players → Make admin**. No SQL needed again.

### Alternative — claim it from the app during the bootstrap window

If you would rather not touch SQL, sign in as the account that should own the team and run this once in the browser console on the app page:

```js
await supabase.rpc('promote_to_admin', { p_email: 'you@example.com' })
```

(In a `npm run dev` session the client is reachable from the console; in a production bundle it is not, so use the SQL method there.)

The email **must** be your own — during the bootstrap window the function compares `p_email` against the caller's own profile and rejects anything else, so this can only ever create an admin out of the person already signed in. The moment one active admin exists, the window shuts and `promote_to_admin()` becomes admin-only.

### Confirm the bootstrap window is closed

```sql
select full_name, email, role, is_active
  from public.profiles
 where role = 'admin';
```

As long as that returns at least one `admin` with `is_active = true`, self-promotion is no longer possible for anyone. The database also refuses to demote the **last** remaining admin, so the team can never lock itself out.

---

## 7. Deploy to GitHub Pages

### a. Add the repository secrets

**Settings → Secrets and variables → Actions → New repository secret**, twice:

| Secret name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your **anon / publishable** key |

Optionally add a repository **variable** `VITE_BASE_PATH` (set it to `/` if you deploy to a custom domain).

Again: never add the `service_role` key as a secret for this workflow — it would be compiled into the public bundle.

### b. Enable Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

### c. Push

```bash
git add .
git commit -m "Add KK Cricket Team application"
git push origin master
```

`.github/workflows/deploy.yml` triggers on pushes to `master` **and** `main`, type-checks, builds with the secrets injected, and publishes `dist/` to Pages. You can also re-run it from the **Actions** tab (`workflow_dispatch`) — handy right after adding the secrets.

Your app lands at:

```
https://bpbhargav28.github.io/kk-cricket-team/
```

Share that single URL with the team.

### d. Why nested routes survive a refresh

GitHub Pages has no server-side routing, so refreshing `…/matches/abc123` would normally 404. `public/404.html` contains the [rafgraph SPA redirect](https://github.com/rafgraph/spa-github-pages): it encodes the requested path into a query string, GitHub serves it, and a small script at the very top of `index.html` restores the real URL with `history.replaceState` before React Router boots. `pathSegmentsToKeep = 1` accounts for the `/kk-cricket-team/` repository segment. A `.nojekyll` file stops Jekyll from eating files that start with an underscore.

---

## How the expense split works

This is the feature the whole app exists for, so it is worth understanding.

**Individual contribution = total match expense ÷ number of confirmed (YES) players.**

₹3,000 across 15 confirmed players is ₹200 each.

### Exact-sum arithmetic

Floating-point division leaves money unaccounted for: ₹1,000 ÷ 3 is ₹333.33 each, which sums to ₹999.99. The split therefore runs entirely in **integer paise** inside Postgres:

```
pool      = round(total_expense × 100) − (sum of manual overrides)
base      = pool / n          -- integer division
remainder = pool % n
```

Every player gets `base` paise, and the first `remainder` players — ordered deterministically by `lower(full_name), player_id` — get one extra paisa. The sum of all contributions therefore **always equals the total expense exactly**, and re-running the calculation produces an identical result.

### Rules

- Only **YES** votes are included.
- Amounts are stored to two decimal places.
- Recalculation happens automatically whenever attendance changes, and whenever an admin changes the total.
- An admin can **manually adjust** any player's contribution; the remaining pool is re-split across everyone else.
- An admin can **exempt** a player (set to ₹0); the rest of the squad covers the balance.
- A player who paid and then withdrew is **never silently deleted**. Their contribution row is preserved as a manual override so the cash is still accounted for and a refund can be decided deliberately.

### Finalized contributions are never changed silently

Closing voting finalizes the split. If an admin then edits the expense or attendance, the app **asks for explicit confirmation** before re-splitting, and the previous figures are written to `contribution_audit` with the admin's identity, timestamp and reason. The database enforces this too: `recalculate_match_contributions()` refuses to touch a finalized match unless it is called with `p_force => true`.

---

## Dates and times

A match's `match_date` (`date`) and `match_time` (`time`) are stored without a timezone and are interpreted as **India local time** — that is what the admin typed and what the team will turn up at. The voting deadline and every `created_at` / `payment_date` column is `timestamptz`, stored as UTC and sent from the browser as an ISO 8601 string.

The one place the two meet is the dashboard's "next match" query, which compares `match_date + match_time` against `now() at time zone 'Asia/Kolkata'` (with a six-hour grace period so a match stays on the dashboard while it is being played). If your team is not in IST, change that expression in `supabase/migrations/20260101000200_functions.sql` and re-run the file.

---

## Security model

> *"Never trust client-side role checks alone."*

The `isAdmin` flag in React decides **what to render** and nothing else. Every privileged action is re-checked in Postgres.

| Layer | What it does |
|---|---|
| **Row Level Security** | Enabled on all seven tables. `anon` has no access to anything (`revoke all … from anon`) |
| **Votes** | A player may insert/update/delete **only their own** vote, and only while `match_voting_is_open(match_id)` returns true |
| **Payments** | The SELECT policy is `player_id = auth.uid() or is_admin()`. Players have **no** INSERT or UPDATE policy at all — they cannot create or alter a payment, including their own |
| **Match-wide totals** | Exposed through the aggregate-only `match_payment_summary` view, so a player sees team totals without any individual's row |
| **Privileged writes** | Go through `SECURITY DEFINER` RPCs, each of which calls `assert_admin()` as its first statement. `EXECUTE` is revoked from `public` and `anon` and granted only to `authenticated` |
| **Role escalation** | A trigger rejects any change to your own `role` / `is_active`; `handle_new_user()` hard-codes `'player'` |
| **Audit trail** | `contribution_audit` has no INSERT, UPDATE or DELETE policy, so it can only ever be appended to by the `SECURITY DEFINER` functions — nobody can rewrite history through the API |
| **Keys** | Only the publishable key reaches the browser. The service-role key appears nowhere in this repository |

### Try to break it

Sign in as a player and run these in the browser console — all of them should fail or return nothing:

```js
// Someone else's payment — returns zero rows, not an error.
await supabase.from('payments').select('*').neq('player_id', myId)

// Changing another player's vote — permission denied.
await supabase.from('match_votes')
  .update({ vote: 'no' }).eq('player_id', someoneElsesId)

// Marking yourself paid — permission denied (no INSERT/UPDATE policy).
await supabase.from('payments')
  .update({ amount_paid: 9999 }).eq('player_id', myId)

// Promoting yourself — the guard trigger rejects it.
await supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)

// Calling an admin RPC — raises "Only team admins can do that".
await supabase.rpc('close_voting', { p_match_id: someMatchId })
```

---

## Project structure

```
kk-cricket-team/
├─ .github/workflows/deploy.yml     # Build + deploy to Pages on push
├─ public/
│  ├─ 404.html                      # SPA fallback for nested routes
│  ├─ .nojekyll
│  ├─ favicon.svg
│  └─ manifest.webmanifest
├─ supabase/
│  ├─ migrations/
│  │  ├─ 20260101000000_initial_schema.sql
│  │  ├─ 20260101000100_row_level_security.sql
│  │  └─ 20260101000200_functions.sql
│  ├─ seed/                         # Dev-only demo data + cleanup
│  └─ tests/verify.sql              # Non-destructive deployment check
├─ src/
│  ├─ components/
│  │  ├─ auth/                      # AuthLayout, route guards
│  │  ├─ layout/                    # AppShell (sidebar + bottom nav), Logo, PageHeader
│  │  ├─ match/                     # VotePanel, VoteResults, ExpenseBreakdown, MatchForm, AuditTrail
│  │  ├─ payments/                  # PaymentList, PaymentSummaryTiles
│  │  └─ ui/                        # Button, Card, Field, Modal, Badge, StatCard…
│  ├─ context/                      # AuthContext, ToastContext
│  ├─ hooks/                        # useAsyncData, useRealtime
│  ├─ lib/
│  │  ├─ api.ts                     # Every Supabase read/write, in one place
│  │  ├─ database.types.ts          # Typed schema mirror
│  │  ├─ errors.ts                  # Postgres/auth errors → human sentences
│  │  ├─ format.ts                  # ₹ currency, dates, initials
│  │  └─ supabase.ts                # Client (publishable key only)
│  ├─ pages/                        # Dashboard, Matches, MatchDetail, Payments, History, Players…
│  ├─ App.tsx                       # Router + guards
│  └─ main.tsx
├─ .env.example                     # Template — never contains real values
└─ vite.config.ts                   # base path, path alias, chunking
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at `localhost:5173/kk-cricket-team/` with HMR |
| `npm run build` | Type-check then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b` — strict type check, no emit |
| `npm test` | Run the unit test suite once |
| `npm run test:watch` | Unit tests in watch mode |

---

## Demo data (development only)

Sample data is **never** bundled into the app or inserted automatically.

1. Sign up three or more accounts in a **development** Supabase project and promote one to admin.
2. In the SQL editor, uncomment the `set local "kk.demo" = …` line at the top of `supabase/seed/demo_data.sql` and run the file.

It refuses to run without that explicit opt-in, refuses to run without an existing admin, creates no auth users, and tags everything it inserts with a `[demo]` prefix. `supabase/seed/demo_cleanup.sql` removes exactly those rows and nothing else.

Optionally set `VITE_ENABLE_DEMO_DATA=true` in `.env` to show a "Demo data" badge in the corner during `npm run dev`. The flag is gated on `import.meta.env.DEV`, so production builds ignore it entirely.

---

## Verifying the deployment

```bash
npm test            # unit tests: formatting, error mapping, split arithmetic
npm run typecheck   # strict TypeScript
npm run build       # production build
npm run preview     # smoke-test the built bundle
```

Then, in the Supabase SQL editor, run `supabase/tests/verify.sql` to confirm RLS, policies, constraints and function privileges are all in place.

A quick manual pass worth doing once, with two browser profiles signed in as different players:

1. Admin publishes a match with a ₹3,000 expense.
2. Both players vote **Yes** — each screen updates without a refresh, and the per-player figure moves.
3. One player switches to **No** — the split recalculates.
4. Admin closes voting — the amounts finalize and the players' votes lock.
5. Admin marks one player **Paid** and the other **Partially paid** — check the match totals and that each player sees only their own record.
6. Admin edits the total expense — confirm the re-split dialog appears, and that the Activity tab records the change.

---

## Troubleshooting

<details>
<summary><strong>The app shows "Supabase is not configured"</strong></summary>

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing or empty. Locally: check `.env` exists in the project root (not in `src/`) and **restart `npm run dev`** — Vite only reads env files at startup. On Pages: check both repository secrets are set, then re-run the workflow (new secrets do not retroactively apply to an old build).
</details>

<details>
<summary><strong>Refreshing a nested URL on GitHub Pages gives a 404</strong></summary>

Confirm `public/404.html` was published (it must be in `dist/` after a build) and that `pathSegmentsToKeep` in it is `1` for a repository-based URL like `/kk-cricket-team/`. If you moved the app to a custom domain, set it to `0` and set `VITE_BASE_PATH=/`.
</details>

<details>
<summary><strong>Assets 404 after deploying, and the page is blank</strong></summary>

The Vite `base` does not match the URL. The default is `/kk-cricket-team/`; if your repository has a different name, the workflow derives it automatically, but for a local `npm run build` set `VITE_BASE_PATH=/<your-repo-name>/`.
</details>

<details>
<summary><strong>"Your profile has not been created yet"</strong></summary>

The `handle_new_user()` trigger did not run, which almost always means migration 1 was not applied. Re-run `20260101000000_initial_schema.sql`, then click **Retry**. To check: `select * from public.profiles;` should contain a row per signed-up user.
</details>

<details>
<summary><strong>The password reset email link does nothing / logs me out</strong></summary>

The redirect URL is not on the allow-list. Add `…/kk-cricket-team/reset-password` for **both** your Pages origin and `http://localhost:5173` under **Authentication → URL Configuration**, exactly as listed in [step 3](#3-configure-supabase-authentication).
</details>

<details>
<summary><strong>Nothing updates in real time</strong></summary>

Realtime needs the tables in the `supabase_realtime` publication — added by migration 1. Verify with:

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
```

You should see `matches`, `match_votes`, `player_contributions` and `payments`. Also check the browser console for websocket errors; a corporate network or VPN blocking `wss://` will break it.
</details>

<details>
<summary><strong>"Only team admins can do that"</strong></summary>

Working as intended — the database rejected a privileged call from a non-admin. If it is your own account, confirm `select role, is_active from public.profiles where id = auth.uid();` returns `admin` / `true`, then sign out and in again.
</details>

<details>
<summary><strong>"Contributions are already finalized"</strong></summary>

Also working as intended. The split will not change silently after it is finalized. Confirm the re-split dialog in the UI, or reopen voting first.
</details>

<details>
<summary><strong>Signup says the email is already registered, but nobody can sign in</strong></summary>

The account exists but the email was never confirmed. Either resend the confirmation from **Authentication → Users**, or turn **Confirm email** off for a small team ([step 3](#3-configure-supabase-authentication)).
</details>

<details>
<summary><strong>The app was working and now every request fails</strong></summary>

Free-tier Supabase projects pause after a week of inactivity. Open the dashboard and click **Restore project**. An off-season cricket team hits this regularly.
</details>

<details>
<summary><strong>Emails stop arriving after a few signups</strong></summary>

The built-in SMTP service is heavily rate-limited and intended for development. Configure custom SMTP under **Project Settings → Auth → SMTP Settings**.
</details>

---

<div align="center">

**KK CRICKET TEAM** 🏏 — see you at the ground on Sunday.

</div>
