import { createHash, sign } from "node:crypto";
import { serviceClient, send } from "../_lib/admin.js";

export default async function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="GET")return send(res,405,{error:"Method not allowed."});
  try {
    const platform=req.query.platform==="android_tv"?"android_tv":"android";
    const channel=["stable","beta","testing"].includes(req.query.channel)?req.query.channel:"stable";
    const deviceId=String(req.query.device_id||"").slice(0,180);
    const currentCode=Math.max(0,Number(req.query.current_version_code)||0);
    if(!deviceId)return send(res,400,{error:"device_id is required for staged rollout evaluation."});
    const supabase=serviceClient();
    const {data:releases,error}=await supabase.from("app_releases")
      .select("id,version,version_code,platform,channel,mandatory,rollout_percent,release_notes,download_url,sha256,file_size,published_at")
      .eq("platform",platform).eq("channel",channel).eq("status","published")
      .gt("version_code",currentCode)
      .order("version_code",{ascending:false}).limit(100);
    if(error)throw error;
    // A staged latest release must not hide an older release the device is
    // eligible for. Evaluate rollout independently for each version.
    const release=(releases || []).find(candidate => {
      if (!candidate.download_url || !/^[a-f0-9]{64}$/i.test(candidate.sha256 || "")) return false;
      const bucket=parseInt(createHash("sha256").update(deviceId+"|"+candidate.id).digest("hex").slice(0,8),16)%100;
      return bucket < Number(candidate.rollout_percent);
    });
    if(!release)return send(res,200,{update_available:false});
    const manifest = {
      version:release.version,
      version_code:Number(release.version_code),
      platform:release.platform,
      channel:release.channel,
      mandatory:release.mandatory,
      release_notes:release.release_notes,
      download_url:release.download_url,
      sha256:release.sha256.toLowerCase(),
      file_size:release.file_size,
      published_at:release.published_at,
    };
    const privateKey=process.env.OTA_SIGNING_PRIVATE_KEY;
    const keyId=process.env.OTA_SIGNING_KEY_ID;
    if(!privateKey||!keyId)return send(res,503,{error:"OTA signing is not configured."});
    const signature=sign(null,Buffer.from(JSON.stringify(manifest)),privateKey).toString("base64");
    return send(res,200,{update_available:true,manifest,signature, key_id:keyId});
  } catch(error) {
    console.error("[ota-manifest]",error);
    return send(res,500,{error:"Update manifest is temporarily unavailable."});
  }
}
