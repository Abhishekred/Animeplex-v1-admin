import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function base64url(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "RS256", typ: "JWT" });
  const payload = base64url({
    iss: account.client_email, scope: SCOPE, aud: GOOGLE_TOKEN_URL,
    iat: now, exp: now + 3500,
  });
  const unsigned = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const jwt = unsigned + "." + signer.sign(account.private_key, "base64url");
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error("Firebase OAuth authentication failed");
  }
  return result.access_token;
}


export async function sendTopicPush({ topic, title, body, data = {} }) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Firebase credentials are not configured");
  const account = JSON.parse(raw);
  if (!account.private_key || !account.client_email || account.project_id !== "animeplex-7361c")
    throw new Error("Invalid Firebase service account");
  if (!/^[a-zA-Z0-9_~%.-]{1,900}$/.test(topic)) throw new Error("Invalid FCM topic");
  const token = await getAccessToken(account);
  const response = await fetch(
    "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(account.project_id) + "/messages:send",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          topic,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k,v]) => [k, String(v)])),
          android: { priority: "high" },
        },
      }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error("FCM rejected message: " + (result?.error?.status || response.status));
  return result.name;
}
