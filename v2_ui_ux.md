I went through every screen added in phases 1–4. All the features work, but the screens look like separate admin forms rather than one product. These are the most important gaps:

- **Dark mode is partly missing.** The new panels hard-code light greys, even though the rest of the dashboard supports dark mode.
- **Nothing tells a brand there's work waiting.** No pending-applications count appears on the tab or campaign.
- **Some flows rely on browser pop-ups or skip confirmation.** Switching to Private uses `window.confirm`, and removing a creator happens with no confirmation or undo.
- **The creator's apply journey is thin.** There's no progress indicator, no draft saving, and little explanation of what happens next.

Below is a hand-off prompt you can paste to Claude as-is.

---

## UI/UX improvement brief: campaign access (Public, Private, Restricted)

**Scope:** only the UI from v2 phases 1–4. **Do not change** API routes, database functions, migrations or response shapes.

**Rules for every change:**
- Match the existing dashboard style: purple `#7F39EC` and `#4A00BE`, and the shadcn components in `components/ui`.
- Support dark mode everywhere, using the existing `isDark` pattern or `dark:` classes.
- Keep components accessible: labels, focus states, `aria-*`, and keyboard use.
- Make every screen work on mobile from 360px wide.

### 1. Shared, across all campaign-access screens

- **Dark mode audit.** Every file in `components/campaign-access/*` uses fixed `text-gray-900`, `bg-gray-50`, `border-gray-200`, `bg-amber-50` and similar. Add dark equivalents. This includes the status boxes in `RestrictedCampaignPreview` and the badges in `ApplicationsPanel`.
- **One badge and colour system** for access modes and statuses:
  - Public = green, Private = slate with a lock, Restricted = purple with a clipboard.
  - Pending = amber, Approved = green, Rejected = red, Withdrawn = grey, Access removed = grey with a strikethrough icon.
  - Build it as one shared component (for example `AccessBadge` / `StatusBadge`) and use it everywhere: opportunity cards, the campaign header, the Applications list and the Access table.
- **Skeleton loaders** that match the final layout, instead of the "Loading…" spinner lines. Needed for the access list, applications, invite links, saved lists and the preview page.
- **Empty states** with an icon, one plain sentence and a primary action:
  - "No creators yet" with Add usernames, Import list and Create invite link buttons.
  - "No applications yet" with Copy campaign link.
- **Confirmations:**
  - Replace `window.confirm` in the edit page's access-mode switch (around line 9911 of `edit/client.tsx`) with a styled `AlertDialog` that explains exactly what will happen.
  - Add a confirm dialog, or an **Undo** toast lasting about 5 seconds, for removing a creator from the access list.
- **Toasts:** keep the wording short and consistent, using one pattern such as "Added 12 creators · 3 not found". Make "not found" and "invalid" usernames expandable so the brand can see which ones failed.
- **Relative dates** ("2 days ago") with the exact date on hover, instead of `toLocaleDateString()`.
- **Avatars:** one shared avatar with an initials fallback in the Access table, Applications list and saved lists. The Access table currently shows no avatars.

### 2. Create and edit campaign: "Who can see this campaign"

Files: `app/dashboard/contests/create/client.tsx` (around line 11700), `app/dashboard/contests/[id]/edit/client.tsx` and `components/campaign-access/AccessModeSelector.tsx`.

- **Clearer mode cards:**
  - Make the cards larger, with a one-line "Best for…" hint. Public: "Maximum reach". Private: "Hand-picked creators". Restricted: "Open call, you choose".
  - Add a small "What creators see" mini-preview inside each card.
- **Progressive disclosure.** After choosing a mode, show only that mode's settings in a clearly titled sub-section with numbered steps:
  - **Restricted:** Step 1 "Preview creators see", Step 2 "Application questions", Step 3 "Invite creators directly (optional)".
  - **Private:** Step 1 "Add creators", Step 2 "Requirements".
- **Live preview for Restricted.** Show a "Preview as creator" panel or modal that renders `RestrictedCampaignPreview` from the current form data (thumbnail, title, prize, preview description and questions), so the brand sees exactly what applicants will see.
- **Preview description:**
  - Placeholder examples ("Who we're looking for, what you'll create, timeline").
  - Turn the character counter amber near the limit.
  - Warn when the field is empty: "Creators will only see the title and prize".
- **"Only show to eligible creators"** is only shown when requirements are on. When it's hidden, add a small disabled hint explaining why ("Turn on a requirement to use this").
- **"Access list skips requirements":** make it a switch with a tooltip giving an example.
- **Unsaved changes.** Show an "Unsaved access changes" indicator, and warn before leaving the page if access settings or questions changed.
- **Mode-switch dialog** (from section 1). The dialog body should say what happens in each case:
  - Public to Private: "{N} creators who already submitted keep access."
  - Any mode to Public: "Active invite links will be revoked."
  - Restricted to Private: "Pending applications stay pending but can't be submitted."

### 3. Application questions editor

File: `components/campaign-access/ApplicationQuestionsEditor.tsx`.

- **Drag-to-reorder** with a grip handle, keeping the up and down buttons for keyboard users.
- **Type picker with icons:** Short text, Long text, Link, Multiple choice, Yes/No. Each card should show a tiny greyed-out preview of how the question will look to creators.
- **Inline validation as the brand types.** Empty prompt, fewer than 2 choices, duplicate choices and over-length text all show a red outline plus a message under the field. Today errors only appear when saving.
- **Starter templates**, a one-click "Add common questions" menu:
  - "Link to your best work" (link)
  - "Why are you a good fit?" (long text)
  - "Follower count range" (choice)
  - "Can you post by {end date}?" (yes/no)
- **Counter:** "3 of 10 questions". The Add button explains why it's disabled at 10.
- **Collapsible question cards** once there are more than 3, showing a one-line summary.
- **Required toggle:** a clear "Required" pill on the collapsed card.
- **Editing notice:** after applications exist, show a banner: "Editing questions doesn't change answers already submitted."

### 4. Applications tab (brand reviewing)

Files: `components/campaign-access/ApplicationsPanel.tsx` and `contest-detail-client.tsx`.

- **Pending count on the tab label,** e.g. "Applications (12)", and on the campaign card in the brand's campaign list.
- **Status tabs:** use real `Tabs` or a segmented control with count badges instead of a row of buttons. Keep Pending as the default.
- **Review view (biggest gain):** a split view or side drawer:
  - Clicking a creator opens a panel with their profile summary: avatar, @username, full name, follower and platform stats if available, trust or quality score, and a link to the full profile.
  - The panel also shows their answers, then large **Approve** and **Reject** buttons.
  - Add **Next / Previous** navigation and keyboard shortcuts (A approve, R reject, J/K next/previous), so a brand can work through dozens quickly.
- **Rows show more at a glance:** the first answer or a link chip, the creator's main platform and follower count, and whether they meet the campaign requirements (a green tick or an amber "Below requirements" tag).
- **Filters and sort:** sort by newest, oldest or most followers if that data exists. Filter by "Meets requirements". Keep the username search but add a clear (×) button.
- **Bulk actions:**
  - Make the bar sticky at the bottom when items are selected.
  - Add "Select all N matching" across pages, capped at 200 to match the API.
  - Show a confirm summary before bulk approving ("Approve 34 creators?").
- **Reject dialog:**
  - Quick-pick reasons as chips: "Audience doesn't match", "Portfolio doesn't fit", "Campaign is full", "Other".
  - Show a preview line: "The creator will see: …".
- **"Access removed" approved rows:** a clear grey badge, a tooltip explaining what happened, and a "Re-approve" button styled as a secondary action.
- **Smoother reviews:** after approving or rejecting, fade the row out instead of reloading the whole list (optimistic update with rollback on error). Keep the page-correction behaviour already implemented.
- **Mobile:** turn the table into cards with the actions at the bottom of each card.
- **Accepting applications toggle:** show "Accepting applications: On/Off" at the top of the tab with a quick switch, so brands don't have to go to the edit page to pause.

### 5. Access tab (Private and Restricted roster)

File: `components/campaign-access/CampaignAccessPanel.tsx`.

- **Restructure:**
  - Top: a summary card ("128 creators have access", split by source as small coloured chips).
  - Then an **"Add creators"** card with three tabs: Usernames, Saved list, Invite link.
  - Then the roster.
  - Today it's a long stack of bordered boxes.
- **Usernames input:**
  - A chip-style input where pasting `a, b, c` turns into removable chips.
  - Live counts of valid and invalid names, plus a CSV upload option.
  - The "N usernames · invalid: x" logic already exists in `AllowlistPicker`, so reuse it here.
- **Add results:** an inline panel after adding: "Added 10 · Already had access 2 · Not found 3 (show)", with copyable not-found names.
- **Roster table:**
  - Add a search box and sortable columns (Creator, Source, Added).
  - Add avatars, row checkboxes, bulk remove with confirmation, and **Export CSV**.
- **Source filter:** show it as chips instead of a dropdown.
- **"Save as list":** move it into a small menu (⋯ "Save roster as a list") with a dialog, so it doesn't look like a primary action next to the filter.
- **Sync from saved lists:** each list shows its last sync time and "+N new since import" when available, with one "Sync all" button.
- **Skip-requirements switch:** move it into a "Settings" section of the tab, with a short example.

### 6. Invite links

File: `components/campaign-access/InviteLinksSection.tsx`.

- **Card per link** showing:
  - the label, a status badge, a uses progress bar ("37 / 50 joined") and the expiry countdown ("Expires in 3 days");
  - one-click Copy, plus Share (native `navigator.share` on mobile) and a **QR code** download.
- **Pre-filled labels.** In the create dialog, offer common label chips (Instagram bio, Story, Email, Discord).
- **After creating a link,** open a success modal with the link selected, a Copy button, a QR code, and "Who can join · expires".
- **Joins per link:** a "View N creators who joined via this link" button that applies the source filter in the roster.
- **Expired and revoked links:** collapse them behind "Show inactive (N)", which exists already. Grey them out and add a "Create a new link like this" action.

### 7. Invite landing page (`/invite/[token]`)

File: `app/invite/[token]/client.tsx`.

- **Richer campaign card:** brand logo or avatar, prize, dates, platform icon and the access-mode badge, all when allowed by link status.
- **Clear step indicator for signed-out users:** "1. Sign in or create account → 2. You're added automatically".
- **Success state:** "You're in!" with a short celebration, an "Open campaign" button, and "You'll find it under Opportunities".
- **Dead links** (expired, full, revoked, ended): a friendly illustration, the reason, and a "Browse open campaigns" button instead of a bare message.
- **Non-creator accounts:** explain clearly and offer "Switch account" (sign out, then sign in).
- **Mobile:** make the buttons full-width and sticky at the bottom.

### 8. Creator view of a Restricted campaign (preview and apply)

File: `components/campaign-access/RestrictedCampaignPreview.tsx`.

- **Hero:**
  - A larger thumbnail with a gradient overlay, then the title, brand and a row of key facts: prize, dates, platform and "X days left to apply".
  - A clear "Restricted · apply to join" explanation with a tooltip: "The brand reviews applications. You'll see the full brief once approved."
- **"How it works" strip:** Apply → Brand reviews → Get notified → Create.
- **Application form:**
  - Show a progress indicator ("2 of 4 answered") and mark required fields clearly.
  - Validate inline as the creator types.
  - Show character counters on text fields, and preview link answers as a chip.
  - **Autosave a draft** of the answers to localStorage per campaign, so a refresh doesn't lose them.
  - Show a confirmation step before sending: a summary of the answers with Edit and Submit.
- **After submitting:** a success state with a checkmark, "We'll notify you", the submission date, and a "Browse other campaigns" button.
- **Status boxes:**
  - Pending: amber, with a timeline "Applied 2 days ago · Under review" and Withdraw as a quiet text button with a confirm.
  - Rejected: soft red, with the brand's reason in a quote block and "Find similar campaigns".
  - Access removed: neutral grey, with an explanation.
  - Approved: green, with "Open the campaign" as the primary button. Consider opening it automatically after a short delay.
- **Applications paused or campaign ended:** clear neutral banners, plus a "Notify me if applications reopen" option if feasible. Treat this as a UI placeholder if there's no backend for it.

### 9. Opportunities list (creator)

File: `app/dashboard/opportunities/client.tsx`.

- **Badges:** use the unified badge (section 1). "Apply to join", "Applied" and "Not approved" should each have a distinct colour, not all amber.
- **Private campaigns the creator can access** get an "Invite only" badge, so creators understand why they can see it.
- **Restricted preview cards:**
  - Show a short preview description line and "Apply" as the card's call to action.
  - Hide the submissions and participants counts, which is done already, and replace them with "Applications open" or "Applications paused".
- **Filter chips:** All, Open to everyone, Apply to join, Invited, My applications.
- **"My applications" view:** the creator's pending, approved and rejected applications in one place, with status and date.

### 10. Saved lists page (`/dashboard/allowlists`)

File: `app/dashboard/allowlists/client.tsx`.

- **Card grid:** name, member count, last updated, and "Used in N campaigns".
- **List detail:** a drawer with chip-style member management (add or paste usernames, remove, search), plus Rename and Delete with confirmation.
- **Create from CSV** and **Duplicate list**.
- **Empty state:** "Save groups of creators you work with often, then add them to any private campaign in one click."
- **In the campaign picker** (`AllowlistPicker`): show member avatars (first 3 plus "+N") and search when there are more than 6 lists.

### 11. Notifications

File: `components/UserNotificationsBell.tsx`.

- **Icons and colours by type:** approved = green tick, rejected = red ×, received = purple inbox, access granted = key.
- **Brand "new application" notification:** clicking it should open the campaign directly on the **Applications** tab (for example `?tab=applications`) and show the pending count.
- **Grouping:** group by campaign and add "Mark all as read".
- **Creator "approved" notification:** clicking it opens the campaign with a short "You're in" banner.

### 12. Brand campaign list and campaign header

- **Header:** show the access mode badge and, for Restricted, "12 pending applications" as a link to the tab.
- **Brand's campaign list cards:** show the mode badge and the pending-applications count.
- **Restricted campaigns:** add a "Share campaign" button in the header that copies the public campaign URL, so brands can promote the open call.

### 13. Quality checks after the changes

- Test light and dark modes, mobile (360px), tablet and desktop.
- Check keyboard-only navigation and screen-reader labels, especially on the review shortcuts, drag-to-reorder and dialogs.
- Confirm no API or response-shape changes. Run `npx tsc --noEmit` and the existing unit tests.
- Test these flows:
  - creating each mode;
  - switching modes with a confirmation dialog;
  - adding creators, invite links and saved lists;
  - applying, withdrawing, approving, rejecting, bulk review and re-approve;
  - reviewing the last application on a page;
  - an invalid question, and a failed question save.

---

**Suggested order:** do sections 1, 4, 8 and 5 first, since they're used most and give the biggest gains. Then 2, 3, 6 and 7. Leave 9–12 for last.

A few items assume data that may not reach the UI today: follower count, "meets requirements" on applicants, link join counts and "used in N campaigns". Ask Claude to show these only where the existing APIs already return them, and to list anything that needs backend work separately.