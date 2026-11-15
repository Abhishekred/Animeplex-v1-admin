import { serviceClient, send } from "../_lib/admin.js";

// Public read-only release manifest; only published APKs are exposed.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  const channel = req.query.channel === "beta" ? "beta" : "stable";
  const platform = req.query.platform === "android_tv" ? "android_tv" : "android";
  try {
    const { data, error } = await serviceClient().from("app_releases")
      .select("id,version,version_code,platform,channel,mandatory,rollout_percent,release_notes,download_url,sha256,file_size,published_at")
      .eq("status", "published").eq("platform", platform)
      .in("channel", channel === "beta" ? ["stable", "beta"] : ["stable"])
      .order("version_code", { ascending: false }).limit(20);
    if (error) throw error;
    const releases = (data || []).filter(row => typeof row.download_url === "string" && row.download_url.startsWith("https://"));
    return res.status(200).json({ schema_version: 1, releases });
  } catch (error) {
    console.error("[public-releases]", error);
    return send(res, 503, { error: "Releases temporarily unavailable." });
  }
}
