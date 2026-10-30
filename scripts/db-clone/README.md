# db-clone: refresh the TEST database from MAIN

This folder copies the **MAIN** (production) Supabase database into the **TEST** Supabase database.
Run it whenever you want TEST to match MAIN again. It needs no Docker and no Supabase CLI.

| | Project | Region | Postgres |
|---|---|---|---|
| MAIN (only ever read) | Game Of Creators, `rjprmbjqetxkramwbrqo` | ap-south-1 | 15 |
| TEST (gets replaced) | GOC_BACKUP_OCT, `gydhmdezinplfptoqdcl` | eu-west-1 | 17 |

**Safety in one paragraph:** MAIN is opened read-only, so the script cannot change it.
TEST is replaced in **one transaction**: if anything fails, Postgres undoes everything and TEST stays exactly as it was.
The script refuses to run if both addresses point to the same project, and it waits for you to type `YES`.

---

## 1. Refresh TEST from MAIN (the normal routine)

Open a PowerShell terminal (the VS Code terminal is fine) and run:

```powershell
cd "D:\Persist Ventures\GoViral\scripts\db-clone"
powershell -ExecutionPolicy Bypass -File .\clone-db.ps1
```

1. Read the plan it prints (step 4): which tables are copied and what is deleted on TEST.
2. Type `YES` in capitals and press Enter. Any other answer cancels and nothing happens.
3. Wait a few minutes; the two projects are in different regions. Don't close the window.
4. Read the end of the output:
   - `Import committed: TEST now holds the copy.` means the copy is done.
   - At the bottom, `TEST is an exact copy of MAIN` means everything matches.
   - Some `DIFFERENT` rows in busy tables (users, submissions, coin_transactions...) are normal when the app was in use during the copy (see section 5).

> **A refresh replaces TEST completely.** Anything created only on TEST (test users, test rows, new tables) is wiped.
> Finish or note down your test work before refreshing.

**Best time to run:** when few people are using the app (for example late night IST), so the copy matches exactly.

### Other ways to run it

| Command (add to the end of the line above) | What it does | Changes anything? |
|---|---|---|
| *(nothing)* | Full refresh of TEST from MAIN | TEST only |
| `-CheckOnly` | Runs all safety checks and shows the plan, then stops | No |
| `-VerifyOnly` | Only compares MAIN and TEST and reports differences | No |
| `-KeepFiles` | Keeps the exported data files afterwards (normally deleted because they contain users' personal data) | TEST only |

What the parts of the command mean:
- `cd "..."` moves into the script's folder.
- `powershell -ExecutionPolicy Bypass -File .\clone-db.ps1` runs this one script. Windows blocks unsigned scripts by default, and `Bypass` allows only this run; it changes no Windows setting.

---

## 2. One-time setup (already done on Vishesh's PC)

You only need this on a new computer, or if a password changes.

### 2a. Postgres tools
The script needs `pg_dump`, `pg_restore` and `psql`, **version 17 or newer**.
On Vishesh's PC they come from Scoop (version 18.3) in `C:\Users\gupta\scoop\apps\postgresql\current\bin`.

> Watch out: this PC also has an **older Postgres 16** in `D:\PostgreSQL\16`, which Windows finds first.
> That is why `PgBinDir` in the config points at the Scoop folder. Don't leave it empty on this PC.

To check a tools folder (this only prints the version):
```powershell
& "C:\Users\gupta\scoop\apps\postgresql\current\bin\pg_dump.exe" --version
```

### 2b. The config file `clone-db.config.json`
It lives in this folder next to `clone-db.ps1` and holds the two database addresses **including passwords**.

```json
{
  "MainDbUrl": "postgresql://postgres.rjprmbjqetxkramwbrqo:MAIN-PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
  "TestDbUrl": "postgresql://postgres.gydhmdezinplfptoqdcl:TEST-PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
  "PgBinDir": "C:\\Users\\gupta\\scoop\\apps\\postgresql\\current\\bin"
}
```

- To get an address, open the project in Supabase, click **Connect**, pick **Session pooler**, and copy the URI (port **5432**, not 6543). Put the database password in place of `[YOUR-PASSWORD]`.
- If the password contains `@ : / ? # %`, write those characters URL-encoded (for example `@` becomes `%40`), or reset the password to letters and digits.
- In `PgBinDir`, write every backslash twice.
- If you reset a database password in Supabase, update it here.
- If you create the file with Notepad, make sure it isn't saved as `clone-db.config.json.txt`; check with `dir`.

> **Never commit this file or paste its contents into chats or screenshots.** `.gitignore` already keeps it out of git.
> If a password leaks, reset it in Project Settings → Database → Reset database password and update this file.

---

## 3. What gets copied, and what you still do by hand

**Copied automatically:**
- Your `public` schema: all tables, columns, keys, indexes, views, functions, types/enums, triggers, RLS policies, and permissions for `anon`, `authenticated` and `service_role`
- All rows of every table, plus sequences (the next id continues from MAIN's numbers)
- Logins: `auth.users` and `auth.identities`, so users sign in on TEST with the same email and password
- Storage: buckets and file *records* (`storage.buckets`, `storage.objects`, ...) and storage access policies
- Your own triggers on `auth.users` (for example a signup trigger that creates the user's profile row)
- Which tables have Realtime switched on
- Extensions MAIN uses are switched on in TEST

**Not copied (do these in TEST's dashboard once, then again only if they change on MAIN):**
- [ ] **Authentication → Sign In / Providers**: the same login methods (for Google and others, also add TEST's callback URL in the provider's console).
- [ ] **Authentication → URL Configuration**: Site URL and Redirect URLs of the test app.
- [ ] **Authentication → Emails / SMTP / Hooks**: templates, SMTP and auth hooks.
- [ ] **Storage files**: only the file records are copied, not the files themselves, so images and documents show as missing until they're uploaded to TEST.
- [ ] **Edge Functions and their secrets**: deploy them to TEST separately.
- [ ] **Cron jobs, Vault secrets, Database Webhooks**: not copied on purpose, so TEST doesn't run production jobs.
- [ ] **Test app settings**: use TEST's Project URL and anon key. Users must log in again on TEST (sessions aren't copied).

> **TEST contains real users' emails and phone numbers.** Make sure nothing on TEST sends real emails, notifications or payouts.
> Use test or sandbox keys for email, payment and notification services there.

---

## 4. What the script does, step by step

| Step | In plain words |
|---|---|
| 1 | Reads the config file, finds the Postgres tools and checks their version. |
| 2 | Safety checks: refuses if MAIN and TEST are the same project, or if port 6543 is used. |
| 3 | Looks at both databases **read-only**. It checks that the extensions, roles and auth/storage columns match, and that TEST allows the data load. It also lists any storage tables it will skip (see section 5). |
| 4 | Shows the plan and waits for `YES`. `-CheckOnly` stops here. |
| 5 | **Exports from MAIN** (read-only): one snapshot of `public` (structure + data), plus users, identities and storage records. |
| 6 | Prepares the import files and leaves out a few lines Supabase does not allow. Each one is listed with its reason in `runs\<date>\removed-lines.txt`. |
| 7 | **Imports into TEST in ONE transaction:** empty TEST, then the structure, then the data (with triggers paused so signup triggers don't create duplicate rows), then a check that every table got exactly the exported number of rows and that every foreign key holds. It commits only if all of that succeeds. |
| 8 | **Compares MAIN and TEST:** exact row counts and content checksums for every table, plus structure, functions, policies, triggers and permissions. |

What the reset in step 7 removes on TEST: everything inside `public` (the schema itself and Supabase's permissions on it stay), TEST's auth users, and TEST's storage records and policies.
Supabase's own schemas (auth, storage, extensions, realtime, vault, ...) are never dropped.

Each run leaves a folder `runs\<date_time>\` with `log.txt` (what was on screen), `removed-lines.txt`, `import-output.txt` (what the reset removed) and `differences.txt` (MAIN vs TEST).
These files contain no passwords. Old run folders can be deleted at any time.

---

## 5. Things that look wrong but are fine

| What you see | Why it's fine |
|---|---|
| `WARN MAIN and TEST run different Postgres major versions` | MAIN is 15 and TEST is 17. Copying from older to newer works. Upgrading MAIN later removes the warning. |
| `Skipped storage tables ... buckets_vectors, vector_indexes` | Newer Supabase tables for vector buckets that the `postgres` account may not change. You don't use them. |
| A few `DIFFERENT` rows at the end, such as users 23,689 vs 23,687 | People used the live app after the snapshot was taken. TEST matches MAIN as of that moment. Run at a quiet time if you want them equal. |
| `DIFFERENT` on a table with equal counts (for example `contests`) | Rows in it were *updated* on MAIN during the copy. |
| Supabase's **Tables page** shows very different row counts (for example `user_notifications`: 354 on MAIN, 8,551 on TEST) | The dashboard shows **estimates**, and MAIN's are out of date. The real counts are equal: check with `select count(*) from public.user_notifications;` in each SQL editor. Running `analyze public.user_notifications;` on MAIN refreshes the estimate; it only updates statistics, not data. |
| `WARNING: Could not copy the comment on schema public` | Only Supabase may change that comment. It's harmless. |

---

## 6. If something goes wrong

The script always ends with a clear message, and **TEST is unchanged whenever the import fails**.

| Message | What to do |
|---|---|
| `Config file not found` | Create `clone-db.config.json` in this folder (section 2b). Check that it isn't named `.json.txt`. |
| `pg_dump is version 16` / `Could not find pg_dump` | Fix `PgBinDir` in the config (section 2a). |
| `MAIN and TEST point to the same Supabase project` | Check the two URLs in the config. One of them is wrong. |
| `password authentication failed` | The password in the config is wrong or was reset. Update it (and URL-encode special characters). |
| `Extension '...' is in schema A on MAIN but in B on TEST` | In TEST's dashboard → Database → Extensions, disable the extension and enable it again in the schema the message names. |
| `MAIN gives permissions to role(s) that do not exist on TEST` | Create that role on TEST (SQL editor: `create role <name>;`), then run again. |
| `The import failed, so it was rolled back` + a red `ERROR` line | Nothing changed. Send the red error lines and `runs\<date>\log.txt` to whoever maintains this script. |

---

## 7. Files in this folder

| File | Purpose |
|---|---|
| `clone-db.ps1` | The script you run. |
| `clone-db.config.json` | Your two database addresses and passwords. **Private, never commit.** |
| `clone-db.config.example.json` | Template for the config file. |
| `sql\inspect.sql` | Read-only look at a database (step 3). |
| `sql\make-extras.sql` | Read-only: reads your auth triggers, storage policies and Realtime settings from MAIN (step 5). |
| `sql\reset-test.sql` | Empties TEST at the start of the import (step 7). Runs **only** on TEST, inside the transaction. |
| `sql\check-foreign-keys.sql` | Checks that every foreign key holds after the load (step 7). |
| `sql\verify.sql` | Read-only comparison of MAIN and TEST (step 8). |
| `runs\` | One folder per run with logs. Ignored by git, safe to delete. |
| `test\` | Only used to test the script on Linux. Not needed on Windows; can be deleted. |
