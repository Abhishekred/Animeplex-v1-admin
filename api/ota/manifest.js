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
    const {data:release,error}=await supabase.from("app_releases")
      .select("id,version,version_code,platform,channel,mandatory,rollout_percent,release_notes,download_url,sha256,file_size,published_at")
      .eq("platform",platform).eq("channel",channel).eq("status","published")
      .order("version_code",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(!release||Number(release.version_code)<=currentCode)return send(res,200,{update_available:false});
    if(!release.download_url||!release.sha256||!/^[a-f0-9]{64}$/i.test(release.sha256)) {
      return send(res,200,{update_available:false,reason:"release_integrity_metadata_incomplete"});
    }
    const bucket=parseInt(createHash("sha256").update(deviceId+"|"+release.id).digest("hex").slice(0,8),16)%100;
    if(bucket>=release.rollout_percent)return send(res,200,{update_available:false,reason:"outside_rollout"});
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
