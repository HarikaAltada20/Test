/**
 * Google Apps Script for Campaign Form Submission
 * This script should be attached to your "Launch Campaign - Get 50% Off" Google Form
 *
 * Setup Instructions:
 * 1. Open your Google Form
 * 2. Click the three dots menu → Script editor
 * 3. Paste this entire script
 * 4. Save the project
 * 5. Go to Triggers → Add trigger
 * 6. Select function: onCampaignFormSubmit
 * 7. Event source: From form
 * 8. Event type: On form submit
 * 9. Save
 */

/**
 * Main handler for campaign form submissions
 * Called automatically when the form is submitted
 */
function onCampaignFormSubmit(e) {
  try {
    const email = extractEmail(e);

    if (!email) {
      Logger.log("❌ Could not find email. Inspecting event object...");
      logEventDebug(e);
      return;
    }

    const SUPABASE_URL = "https://rjprmbjqetxkramwbrqo.supabase.co";
    const SUPABASE_SERVICE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcHJtYmpxZXR4a3JhbXdicnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDg3NTIyNiwiZXhwIjoyMDYwNDUxMjI2fQ.RG_cN-NXCfMIWJQvenMaKo86iK6OXWhjYLTX5QDS3fY";

    // Check duplicate in campaign_form_submissions table
    const checkResp = UrlFetchApp.fetch(
      `${SUPABASE_URL}/rest/v1/campaign_form_submissions?email=eq.${encodeURIComponent(
        email
      )}`,
      {
        method: "get",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Accept: "application/json",
        },
        muteHttpExceptions: true,
      }
    );

    const existing = JSON.parse(checkResp.getContentText() || "[]");
    if (Array.isArray(existing) && existing.length > 0) {
      Logger.log(
        `⛔ Duplicate blocked for ${email} in campaign_form_submissions`
      );

      // Update submitted_at timestamp if record exists
      const updateResp = UrlFetchApp.fetch(
        `${SUPABASE_URL}/rest/v1/campaign_form_submissions?email=eq.${encodeURIComponent(
          email
        )}`,
        {
          method: "patch",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: "return=minimal",
          },
          payload: JSON.stringify({ submitted_at: new Date().toISOString() }),
          muteHttpExceptions: true,
        }
      );

      Logger.log(`Update status: ${updateResp.getResponseCode()}`);
      return;
    }

    // Insert new record
    const payload = {
      email: email,
      submitted_at: new Date().toISOString(),
    };

    const insertResp = UrlFetchApp.fetch(
      `${SUPABASE_URL}/rest/v1/campaign_form_submissions`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "return=minimal",
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      }
    );

    const statusCode = insertResp.getResponseCode();
    Logger.log(`✅ Campaign form submission insert status: ${statusCode}`);

    if (statusCode !== 201 && statusCode !== 200) {
      Logger.log(`❌ Error response: ${insertResp.getContentText()}`);
    }
  } catch (err) {
    Logger.log(`❌ Error in onCampaignFormSubmit: ${err}`);
  }
}

/**
 * Extracts email from either a Form trigger (e.response) or a Sheet trigger (e.namedValues).
 * Reusable function for both survey and campaign forms
 */
function extractEmail(e) {
  // Case A: Form-bound trigger
  if (e && e.response && typeof e.response.getItemResponses === "function") {
    // If "Collect email addresses" is turned on:
    const respondentEmail =
      e.response.getRespondentEmail && e.response.getRespondentEmail();
    if (respondentEmail) return respondentEmail;

    // Otherwise, scan item responses for an email-looking answer
    const itemResponses = e.response.getItemResponses();
    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = (ir.getItem().getTitle() || "").toLowerCase();
      var answer = (ir.getResponse() || "").toString().trim();
      if (isLikelyEmailField(title) || looksLikeEmail(answer)) {
        return answer;
      }
    }
    return null;
  }

  // Case B: Sheet-bound trigger (on form submit in the linked spreadsheet)
  if (e && e.namedValues) {
    // Try common keys or scan all keys for one containing "email"
    const nv = e.namedValues;
    const direct =
      nv["Email"] ||
      nv["Email address"] ||
      nv["E-mail"] ||
      nv["E-mail address"];
    if (direct && direct[0]) return direct[0].toString().trim();

    for (var key in nv) {
      if (!nv.hasOwnProperty(key)) continue;
      if (key && key.toLowerCase().indexOf("email") !== -1) {
        var val = nv[key] && nv[key][0];
        if (val) return val.toString().trim();
      }
    }
    return null;
  }

  return null;
}

/**
 * Checks if a form field title is likely an email field
 */
function isLikelyEmailField(title) {
  return title.includes("email") || title.includes("e-mail");
}

/**
 * Validates if a string looks like an email address
 */
function looksLikeEmail(s) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

/**
 * Debug logging function to help troubleshoot email extraction issues
 */
function logEventDebug(e) {
  try {
    if (e && e.response) {
      var titles = [];
      var itemResponses = e.response.getItemResponses();
      for (var i = 0; i < itemResponses.length; i++) {
        titles.push(itemResponses[i].getItem().getTitle());
      }
      Logger.log("Form titles: " + JSON.stringify(titles));
      var respondentEmail =
        e.response.getRespondentEmail && e.response.getRespondentEmail();
      Logger.log("respondentEmail: " + respondentEmail);
    } else if (e && e.namedValues) {
      Logger.log(
        "namedValues keys: " + JSON.stringify(Object.keys(e.namedValues))
      );
    } else {
      Logger.log("Unknown event shape: " + JSON.stringify(e));
    }
  } catch (err) {
    Logger.log("Error logging debug info: " + err);
  }
}
