import { serviceClient, send } from "../_lib/admin.js";
export default async function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Cache-Control","public, max-age=60, stale-while-revalidate=300");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="GET") return send(res,405,{error:"Method not allowed."});
  try {
    const {data,error}=await serviceClient().from("app_announcements")
      .select("id,title,body,type,action_url,updated_at")
      .eq("is_active",true).order("created_at",{ascending:false}).limit(30);
    if(error) throw error;
    return res.status(200).json({announcements:data||[]});
  } catch(error) {
    console.error("[public-announcements]",error);
    return send(res,503,{error:"Announcements temporarily unavailable."});
  }
}
