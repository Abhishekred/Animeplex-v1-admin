import { serviceClient, send } from "../_lib/admin.js";

// Public, read-only app configuration. Never expose arbitrary admin settings.
const PUBLIC_KEYS = ["app_ui", "theme_preset", "feature_flags", "home_message"];
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  try {
    const { data, error } = await serviceClient().from("app_settings")
      .select("key,value,updated_at").in("key", PUBLIC_KEYS);
    if (error) throw error;
    const settings = {};
    for (const row of data || []) settings[row.key] = row.value;
    return res.status(200).json({ schema_version: 1, settings });
  } catch (error) {
    console.error("[public-app-config]", error);
    return send(res, 503, { error: "App configuration temporarily unavailable." });
  }
}
