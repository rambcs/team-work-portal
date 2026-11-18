# Team Work Portal

Task assignment, daily timesheets and team tracking for an audit team. Hosted free on GitHub Pages; Supabase runs the logins, database, push alerts and summary emails.

## What it does

**Manager**
- **Team:** for any day, see each person's login, logout and hours, drawn as a day ledger, plus anything overdue or blocked.
- **Assignments:** assign tasks, areas/roles or instructions to one or more people. Each assignment can carry a client and engagement, due date, priority, instructions and OneDrive reference links. Afterwards, the portal offers to notify them on WhatsApp.
- **Timesheets:** see anyone's day, or the whole team's week.
- **Reports:** daily and weekly summary tables, which you can download as CSV or email to yourself. They are also emailed automatically every evening and each Saturday.
- **Setup:** manage people (names, WhatsApp numbers, roles, access), clients and engagements.

**Team member**
- **My day:** log in and log out, see the day ledger and your tasks by due date.
- **Tasks:** post updates on a task that set its status, link the updated OneDrive file or folder, and add remarks.
- **Timesheet:** login and logout times plus hours for each task.
- **Alerts:** a pop-up on phone or laptop whenever a task is assigned or updated, even when the portal is closed.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The portal |
| `config.js` | Supabase address, public key, public push key |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Push alerts and "add to Home Screen" |
| `supabase/schema.sql` | Original database setup (already run) |
| `supabase/upgrade_v2.sql` | Version 2 database upgrade |
| `supabase/functions/send-push/index.ts` | Server function that sends push alerts |
| `supabase/functions/daily-summary/index.ts` | Server function that sends summary emails |

The private keys (push private key, shared secret, Gmail app password) live only in Supabase. Never put them in this repo.

## Setting up version 2

Do these on a laptop, in order.

1. **Upgrade the database.** In Supabase, open SQL Editor, paste `supabase/upgrade_v2.sql` and click Run.
2. **Create a Gmail app password.** Use the Gmail account that will send the summaries. Go to myaccount.google.com, then Security, and turn on 2-Step Verification. Then search for "App passwords", create one named "Team portal" and copy the 16-letter password.
3. **Add the secrets.** In Supabase, go to Edge Functions, then Secrets, and add each name and value from your private setup file.
4. **Deploy the two functions.** Go to Edge Functions and choose Deploy a new function, then Via Editor:
   - Name it `send-push`, paste `supabase/functions/send-push/index.ts` and deploy.
   - Name it `daily-summary`, paste `supabase/functions/daily-summary/index.ts` and deploy.
   - For **each** function, open its settings and turn **off** "Verify JWT" (also called "Enforce JWT verification"), then save. Each function checks access itself.
5. **Turn on alerts and schedules.** Run the private `setup_alerts.sql` in SQL Editor. It should list two jobs.
6. **Upload the site.** In GitHub, choose Add file, then Upload files, and drag in everything from this folder. Commit.
7. **Fill in your details in the portal.** Open Profile, add your summary email and click Save. Then click Turn on alerts. In Setup, add each person's WhatsApp number.
8. **Test.** In Reports, click "Email me this summary".

### Schedule
- Daily summary: Monday to Saturday at 7:00 pm.
- Weekly summary: Saturday at 7:15 pm.
- Both go to every manager who has a summary email in their Profile.

To change the times, edit the two `cron.schedule` lines in `setup_alerts.sql` (times are in UTC; India is UTC+5:30) and run the file again.

### Alerts on phones
- **Android (Chrome):** open the portal, then Profile, then Turn on alerts.
- **iPhone:** open the portal in Safari, tap Share, then Add to Home Screen. Open it from the Home Screen icon, then go to Profile and Turn on alerts. Apple only allows alerts for portals added to the Home Screen.
- **Laptop (Chrome or Edge):** Profile, then Turn on alerts.

Alerts go to the device each person turned them on for. If several people share one device, the last person to sign in on it gets the alerts.

## Adding team members
In Supabase, go to Authentication, then Users, then Add user, then Create new user. Use an email-style ID such as `name@bcs.team`, set a password and tick **Auto Confirm User**. They appear in Setup straight away. There is no "forgot password" email, so reset passwords from the same Supabase screen.
