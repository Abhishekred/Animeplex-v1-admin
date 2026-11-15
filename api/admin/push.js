import { createSign } from "node:crypto";
import { audit, requireAdmin, send } from "../_lib/admin.js";

const TOPIC = "all";
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }
  const ctx = await requireAdmin(req, res, ["owner", "admin"]);
  if (!ctx) return;

  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const link = String(req.body?.url || "").trim();
  if (!title || title.length > 120 || !body || body.length > 1000) {
    return send(res, 400, { error: "Title (1-120) and message (1-1000) are required." });
  }
  if (link) {
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      return send(res, 400, { error: "Notification URL must be HTTPS." });
    }
  }

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return send(res, 503, { error: "Firebase credentials are not configured." });
    const account = JSON.parse(raw);
    if (!account.private_key || !account.client_email || account.project_id !== "animeplex-7361c") {
      return send(res, 503, { error: "Firebase credentials are invalid or for the wrong project." });
    }
    const token = await getAccessToken(account);
    const message = {
      message: {
        topic: TOPIC,
        notification: { title, body },
        data: { type: "admin_broadcast", ...(link ? { url: link } : {}) },
        android: { priority: "high" },
      },
    };
    const response = await fetch(
      "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(account.project_id) + "/messages:send",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      console.error("FCM send failed", response.status, result?.error?.status);
      return send(res, 502, { error: "Firebase rejected the message.", code: result?.error?.status || "FCM_ERROR" });
    }
    await audit(ctx, "notification.broadcast", "fcm_topic", TOPIC, { title, messageId: result.name });
    return send(res, 200, { ok: true, messageId: result.name, topic: TOPIC });
  } catch (error) {
    console.error("FCM broadcast error", error?.message);
    return send(res, 500, { error: "Unable to send notification." });
  }
}
