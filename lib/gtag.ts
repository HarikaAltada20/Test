declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = "G-8J6VZKVWLF";
const GA_EVENT_TIMEOUT_MS = 500;

function getGtag(): Window["gtag"] | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (typeof window.gtag === "function") {
    return window.gtag;
  }

  return undefined;
}

export function trackGtagEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  return new Promise((resolve) => {
    const gtag = getGtag();
    if (!gtag) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push([
        "event",
        eventName,
        {
          ...params,
          send_to: GA_MEASUREMENT_ID,
        },
      ]);
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const timeoutId = window.setTimeout(finish, GA_EVENT_TIMEOUT_MS);

    gtag("event", eventName, {
      ...params,
      send_to: GA_MEASUREMENT_ID,
      event_callback: () => {
        window.clearTimeout(timeoutId);
        finish();
      },
      event_timeout: 2000,
    });
  });
}

export function trackViewDetailsClick(contestId: string): Promise<void> {
  return trackGtagEvent("view_details", {
    contest_id: contestId,
    source: "opportunities",
    page_path: window.location.pathname,
    page_location: window.location.href,
  });
}

export function trackSubmitEntryClick(contestId: string): Promise<void> {
  return trackGtagEvent("submit_entry", {
    contest_id: contestId,
    source: "opportunities",
    page_path: window.location.pathname,
    page_location: window.location.href,
  });
}
