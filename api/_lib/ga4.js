import { createSign } from "node:crypto";

// Firebase's service account can access GA4 only when granted access to the
// linked Analytics property. Keep all credentials and GA4 API calls server-side.
const base64url = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
export async function ga4Token(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "RS256", typ: "JWT" });
  const payload = base64url({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3000,
  });
  const sign = createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  const jwt = header + "." + payload + "." + sign.sign(credentials.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("GA4 OAuth token unavailable");
  const token = await response.json();
  return token.access_token;
}
async function runReport(property, token, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`GA4 report unavailable (${response.status})`);
  return response.json();
}
const metric = report => Number(report.rows?.[0]?.metricValues?.[0]?.value || 0);
export async function getFirebaseTelemetry() {
  const property = process.env.GA4_PROPERTY_ID?.trim();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!property || !/^[0-9]+$/.test(property) || !raw) {
    return { configured: false, message: "Set GA4_PROPERTY_ID and FIREBASE_SERVICE_ACCOUNT_JSON to enable Firebase Analytics reports." };
  }
  try {
    const credentials = JSON.parse(raw);
    const token = await ga4Token(credentials);
    const [daily, weekly, monthly, source, playback] = await Promise.all([
      ...[1, 7, 30].map(days => runReport(property, token, {
        dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      })),
      runReport(property, token, {
        dateRanges: [{ startDate: "6daysAgo", endDate: "today" }],
        dimensions: [{ name: "customEvent:outcome" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: "source_load" } } },
        limit: 20,
      }),
      runReport(property, token, {
        dateRanges: [{ startDate: "6daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: ["playback_failure", "playback_source_selected"] } } },
        limit: 20,
      }),
    ]);
    return {
      configured: true, updatedAt: new Date().toISOString(),
      dau: metric(daily), wau: metric(weekly), mau: metric(monthly),
      sourceEvents: (source.rows || []).map(row => ({ outcome: row.dimensionValues?.[0]?.value || "unknown", count: Number(row.metricValues?.[0]?.value || 0) })),
      playbackEvents: (playback.rows || []).map(row => ({ event: row.dimensionValues?.[0]?.value || "unknown", count: Number(row.metricValues?.[0]?.value || 0) })),
    };
  } catch {
    return { configured: true, unavailable: true, message: "GA4 reports unavailable. Check property ID, linked Firebase project, GA4 access and registered event dimensions." };
  }
}
