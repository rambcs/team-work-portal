# Team Work Portal

A small web portal for an audit team:

- **Assignments.** The manager assigns tasks, areas/roles or instructions to one or more team members, with a client and engagement, due date, priority and detailed notes.
- **My day.** Each member sees their overdue, due-today and upcoming work. They update the status and post comments on each task.
- **Timesheets.** Members log their daily hours against an engagement and, optionally, a task. The manager sees a weekly grid for the whole team and totals per engagement.
- **Team view.** The manager sees, for any day, who has logged time, what they did, and what is overdue or blocked.
- **Setup.** The manager maintains clients, engagements and team members.

It is a plain HTML/JavaScript site with no build step. It is hosted free on GitHub Pages and uses a free **Supabase** project for logins and the database.

**Who can see what** (enforced in the database, not just hidden in the screens):

| | Manager | Member |
|---|---|---|
| Tasks | All | Only their own |
| Change task details | Yes | No. They can only change the status and post updates |
| Timesheets | Read everyone's | Only their own (read + edit) |
| Clients and engagements | Create and edit | Read only |
| Deactivated users | n/a | See nothing |

---

## Setup (about 30 minutes, easiest on a laptop)

### 1. Create a GitHub account and repository
1. Sign up at **github.com** (free).
2. Click **+ → New repository**. Name it `team-work-portal` and choose **Public**, because free GitHub Pages needs a public repo. The code holds no client data; all data stays in Supabase behind logins. Tick **Add a README** and click **Create repository**.
3. In the repo, click **Add file → Upload files**. Drag in **everything inside** this folder (`index.html`, `app.js`, `styles.css`, `config.js`, `README.md`, `.nojekyll` and the `supabase` folder), then click **Commit changes**.

> If you'd rather keep the repo private, connect it to **Vercel** or **Netlify** instead of GitHub Pages. Both host private repos free.

### 2. Create the Supabase project
1. Sign up at **supabase.com** with your GitHub account, then click **New project**.
   Region: **South Asia (Mumbai)**. Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql` and click **Run**.
   You should see "Success. No rows returned".
3. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up".
   Only people you add yourself can then get in.

### 3. Connect the site to Supabase
1. In Supabase, open **Project Settings → API** (or the **Connect** button). Copy the **Project URL** and the **anon public** key.
   Never use the `service_role` key in the site.
2. In GitHub, open `config.js`, click the ✏️ pencil, paste the two values in place of the placeholders and click **Commit changes**.

### 4. Turn on the website
1. In the GitHub repo, go to **Settings → Pages → Build and deployment**. Set Source to **Deploy from a branch**, Branch to **main** and folder to **/ (root)**, then click **Save**.
2. After a minute or two the address appears at the top of that page, e.g. `https://yourname.github.io/team-work-portal/`.
3. In Supabase, go to **Authentication → URL Configuration**. Set **Site URL** to that address and add it under **Redirect URLs**.

### 5. Add yourself and make yourself manager
1. In Supabase, go to **Authentication → Users → Add user → Create new user**. Enter your email and a password, tick **Auto Confirm User**, then click **Create**.
2. In **SQL Editor**, run (with your email):
   ```sql
   update public.profiles set role = 'manager' where email = 'you@yourfirm.com';
   ```
3. Open the portal and sign in. You'll land on **Team view**. Go to **Setup** to add clients and engagements.

### 6. Add your team
For each person, go to **Authentication → Users → Add user → Create new user** with their email and a temporary password, and tick Auto Confirm. Send them the portal link and their login. They can change the password from the **Password** link at the top. In the portal's **Setup** tab you can fix their display name, make someone a second manager, or **Deactivate** someone who leaves. Their history is kept.

> **Why not invite emails?** Supabase's free built-in email service only delivers to a few pre-approved addresses and is heavily rate-limited. Creating users with a password avoids email entirely. The "email me a sign-in link" button only works once you add your own email provider (**Project Settings → Authentication → SMTP**).

---

## Good to know
- **Free-tier limits.** Supabase pauses a free project after about a week with no activity. Daily use keeps it awake; if it does pause, click **Restore** in the dashboard. The free tier is far more than a small team needs.
- **Backups.** The free tier has no point-in-time backups. To export, use Supabase **Table Editor → (table) → Export to CSV**.
- **History loaded.** The screens load the last 180 days of timesheets (`HISTORY_DAYS` in `app.js`). Older data stays in the database.
- **Live updates.** Changes made by others appear within a second or two, and also whenever you switch back to the tab.
- **Client confidentiality.** Engagement names and work descriptions are stored in your Supabase project. Check this fits your firm's data policy.

## Files
```
index.html            page shell
styles.css            styling (mobile-first)
app.js                all app logic (Supabase JS loaded from CDN)
config.js             your Supabase URL + anon key  ← edit this
supabase/schema.sql   tables, security rules, triggers ← run once in Supabase
.nojekyll             tells GitHub Pages to serve files as-is
```
