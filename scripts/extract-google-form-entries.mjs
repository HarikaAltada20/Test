const url =
  "https://docs.google.com/forms/d/e/1FAIpQLSf7C6hOBIr90e8pBDt9mMo4AzJaFM0Dlbud-EleVIPtuCC68A/viewform";
const res = await fetch(url);
const html = await res.text();

const fbMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);/s);
if (fbMatch) {
  const data = JSON.parse(fbMatch[1]);
  const questions = data[1][1];
  questions.forEach((q, i) => {
    const title = q[1];
    const entryId = q[4]?.[0]?.[0];
    const type = q[3];
    console.log(`${i + 1}. [${type}] entry.${entryId} — ${title}`);
    if (q[4]?.[0]?.[1]) {
      console.log("   options:", q[4][0][1].map((o) => o[0]).join(" | "));
    }
  });
} else {
  console.log("FB_PUBLIC_LOAD_DATA_ not found");
  console.log([...new Set(html.match(/entry\.\d+/g) || [])].join("\n"));
}
