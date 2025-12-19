# Google Apps Script Setup Guide

This guide explains how to set up Google Apps Script to automatically save form submissions to Supabase.

## 📋 Overview

There are two separate scripts:

1. **Survey Form Script** - Saves to `form_submissions` table
2. **Campaign Form Script** - Saves to `campaign_form_submissions` table

## 🚀 Setup Instructions for Campaign Form

### Step 1: Open Your Google Form

1. Go to your Google Form: `https://docs.google.com/forms/d/e/1FAIpQLSd_5loTYAlHNrcbONTSXvj3RsSUGDQMwdoV-YxCYYEG9DpXqQ/viewform`
2. Make sure you have edit access

### Step 2: Open Script Editor

1. Click the **three dots menu** (⋮) in the top right
2. Select **Script editor**

### Step 3: Paste the Script

1. Delete any existing code in the editor
2. Copy the entire contents of `SUPABASE/google-apps-script-campaign-form-submit.js`
3. Paste it into the script editor
4. Click **Save** (💾) or press `Ctrl+S` / `Cmd+S`
5. Give your project a name (e.g., "Campaign Form Submission Handler")

### Step 4: Set Up the Trigger

This is the most important step! The trigger tells Google Apps Script when to run your function.

#### Method 1: Adding Trigger from Script Editor (Recommended)

1. **In the Script Editor**, look at the left sidebar menu
2. You'll see several icons:
   - 📁 Files
   - ⏰ **Triggers** ← Click this one!
   - 📊 Executions
   - 🔐 Project settings
3. Click on **Triggers** (⏰ icon)
4. You'll see a page that says "No triggers set up. Click here to add one now."
5. Click the **+ Add Trigger** button (usually in the bottom right corner)
6. A popup window will appear with trigger configuration options
7. Fill in the following fields:
   - **Function to run**:
     - Click the dropdown
     - Select `onCampaignFormSubmit`
   - **Event source**:
     - Click the dropdown
     - Select `From form`
   - **Event type**:
     - Click the dropdown
     - Select `On form submit`
   - **Failure notification settings**:
     - Leave as default (notify me immediately) or customize
8. Click **Save** button
9. **Authorization Required**:
   - A popup will appear asking for authorization
   - Click **Review permissions**
   - Select your Google account
   - You may see a warning: "Google hasn't verified this app"
   - Click **Advanced** → **Go to [Your Project Name] (unsafe)**
   - Click **Allow**
   - You may need to verify your account with 2FA if enabled

#### Method 2: Adding Trigger from Form Settings (Alternative)

1. Go back to your **Google Form**
2. Click the **three dots menu** (⋮) in the top right
3. Select **Get pre-filled link** or go to **Settings** (⚙️)
4. Look for **Scripts** or **Apps Script** option
5. Follow similar steps as Method 1

#### Verifying Your Trigger

After setting up the trigger:

1. Go back to **Script Editor** → **Triggers** tab
2. You should now see a trigger listed with:
   - Function: `onCampaignFormSubmit`
   - Event: `From form - On form submit`
   - Status: Should show as active/running
3. If you see any errors, click on the trigger to edit it

#### Common Trigger Issues

**Issue: "No function found"**

- Make sure you saved the script with the function `onCampaignFormSubmit`
- Check for typos in the function name
- The function name must match exactly (case-sensitive)

**Issue: "Authorization required"**

- You must authorize the script to run
- Follow the authorization steps above
- Make sure you're logged into the correct Google account

**Issue: Trigger not showing up**

- Refresh the page
- Make sure you're in the Script Editor (not Form Editor)
- Check that you clicked "Save" after adding the trigger

#### Editing or Deleting a Trigger

1. Go to **Triggers** tab
2. Find your trigger in the list
3. Click the **pencil icon** (✏️) to edit
4. Or click the **trash icon** (🗑️) to delete
5. Make changes and click **Save**

### Step 5: Test the Script

1. Submit a test form with your email
2. Check the script logs:
   - In Script Editor, click **Executions** (📊) in the left sidebar
   - Look for recent executions
   - Click on an execution to see logs
3. Verify in Supabase:
   - Go to your Supabase dashboard
   - Navigate to **Table Editor** → `campaign_form_submissions`
   - Check if your test submission appears

## 🔍 Troubleshooting

### Email Not Found

If you see "❌ Could not find email" in logs:

- Make sure your form has an email field
- Enable "Collect email addresses" in form settings:
  - Form → Settings (⚙️) → **Collect email addresses**
- Or ensure one of your form fields is titled "Email", "Email address", etc.

### Duplicate Submissions

The script checks for duplicates and updates `submitted_at` if a record already exists. This is expected behavior.

### Script Not Running

1. Check that the trigger is set up correctly
2. Verify the function name matches exactly: `onCampaignFormSubmit`
3. Check the execution logs for errors
4. Make sure the Supabase service key is correct

### Testing the Script Manually

You can test the script manually:

1. In Script Editor, select `onCampaignFormSubmit` from the function dropdown
2. Click **Run** (▶️)
3. Note: This won't work without a form event, but you can test `extractEmail` separately

## 📝 Notes

- The script uses the Supabase REST API with service role key
- Email extraction works for both form-bound and sheet-bound triggers
- Duplicate submissions update the `submitted_at` timestamp
- All operations are logged for debugging

## 🔐 Security

⚠️ **Important**: The service key in the script has full database access. Keep your script private and don't share it publicly.

## 📊 Monitoring

Check script execution logs regularly:

- Script Editor → **Executions** tab
- Look for successful insertions (status 201)
- Check for any errors or warnings

## 🔄 Updating the Script

If you need to update the script:

1. Edit the code in Script Editor
2. Save the changes
3. The trigger will automatically use the updated code

---

## 📸 Visual Guide: Where to Find Triggers

### In Script Editor:

```
┌─────────────────────────────────────┐
│  Google Apps Script                 │
├─────────────────────────────────────┤
│  [📁] Files                         │
│  [⏰] Triggers  ← Click here!       │
│  [📊] Executions                    │
│  [🔐] Project settings              │
└─────────────────────────────────────┘
```

### Trigger Configuration Window:

```
┌─────────────────────────────────────┐
│  Add Trigger                        │
├─────────────────────────────────────┤
│  Function to run:                   │
│  [▼] onCampaignFormSubmit           │
│                                     │
│  Event source:                      │
│  [▼] From form                     │
│                                     │
│  Event type:                        │
│  [▼] On form submit                │
│                                     │
│  [Cancel]  [Save]                  │
└─────────────────────────────────────┘
```

## 🔄 Managing Multiple Triggers

If you have both survey and campaign forms:

1. **Survey Form**: Use function `onFormSubmit` → saves to `form_submissions`
2. **Campaign Form**: Use function `onCampaignFormSubmit` → saves to `campaign_form_submissions`

Each form needs its own trigger pointing to the correct function.

## 📞 Support

If you encounter issues:

1. Check the execution logs in Google Apps Script
2. Verify the table exists in Supabase
3. Check Supabase logs for API errors
4. Ensure RLS policies allow inserts
5. Verify trigger is active (green checkmark in Triggers tab)
