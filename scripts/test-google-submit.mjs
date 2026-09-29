const FORM_ID = "1FAIpQLSf7C6hOBIr90e8pBDt9mMo4AzJaFM0Dlbud-EleVIPtuCC68A";
const url = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

const params = new URLSearchParams();
params.append("entry.953405649", "Test Brand API");
params.append("entry.252800795", "https://example.com");
params.append("entry.183190247", "SaaS");
params.append("entry.1489914077", "United States");
params.append("entry.1361951032", "Viral reach test");
params.append("entry.2109640101", "Google Ads");
params.append("entry.392490872", "Under $1,000");
params.append("entry.1171856862", "Growth Mode ($500 - $2,500)");
params.append("entry.1434148185", "+15551234567");
params.append("entry.124018534", "Millennials (26-40)");
params.append("entry.1754931358", "Instagram");
params.append("entry.94215581", "4");
params.append(
  "entry.170082596",
  "Contact email: smoke-test@example.com\n\nAutomated smoke test",
);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: params.toString(),
  redirect: "manual",
});

console.log("Status:", res.status);
console.log("OK:", res.status === 200 || res.status === 302);
