// Read-only, authenticated repository catalogue discovery for AnimePlex admin.
// Parses ecosystem-specific JSON manifests. Never executes downloaded code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const allowedKinds = new Set(["mangayomi","zangetsu","stremio","cloudstream","aniyomi","mihon","lnreader"]);
const admin = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
  auth:{persistSession:false,autoRefreshToken:false}
});
const cors={
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"POST, OPTIONS",
  "access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
  "content-type":"application/json; charset=utf-8","cache-control":"no-store",
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const str=(value:unknown,max=120)=>typeof value==="string"?value.trim().slice(0,max):"";
const cleanId=(value:unknown)=> {
  const id=String(value??"").trim();
  return /^[A-Za-z0-9_./:-]{1,220}$/.test(id)?id:null;
};
const hostAllowed=(hostname:string)=>{
  const h=hostname.toLowerCase().replace(/\.$/,"");
  if(!h || h.length>253 || h==="localhost" || h.endsWith(".localhost") ||
    h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".test") ||
    h.endsWith(".invalid") || h.endsWith(".example") || h.endsWith(".onion") ||
    /^\d+(?:\.\d+){0,3}$/.test(h) || h.includes(":") ||
    h.startsWith("metadata.") || h==="0.0.0.0")return false;
  return /^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(h);
};
function safeUrl(raw:unknown):URL{
  if(typeof raw!=="string"||raw.length>700)throw Error("HTTPS repository URL required");
  let uri:URL;
  try{uri=new URL(raw.trim());}catch{throw Error("Invalid repository URL");}
  if(uri.protocol!=="https:"||!hostAllowed(uri.hostname)||uri.username||uri.password||
    uri.hash||uri.port||uri.search||
    uri.pathname.split("/").some(x=>x===".."||x==="."))
    throw Error("Only public HTTPS repository URLs without login credentials or query tokens are accepted");
  return uri;
}
function join(base:string,file:string):string{
  return new URL(file,base.endsWith("/")?base:base+"/").toString();
}
async function loadJson(url:string):Promise<any>{
  const u=safeUrl(url);
  const controller=new AbortController();
  const stop=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(u,{redirect:"manual",signal:controller.signal,headers:{accept:"application/json"}});
    if(!res.ok)throw Error("HTTP "+res.status+" from repository");
    const bytes=Number(res.headers.get("content-length")||0);
    if(bytes>12000000)throw Error("Index too large (12 MB maximum)");
    const reader=res.body?.getReader();
    if(!reader)throw Error("Empty repository response");
    const chunks:Uint8Array[]=[];let total=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value){total+=value.length;if(total>12000000){await reader.cancel();throw Error("Index too large");}chunks.push(value);}
    }
    const all=new Uint8Array(total);let offset=0;
    for(const part of chunks){all.set(part,offset);offset+=part.length;}
    return JSON.parse(new TextDecoder().decode(all));
  }finally{clearTimeout(stop);}
}
type Entry={id:string;name:string;type:string;lang:string;version:string;detail?:string};
function one(id:unknown,name:unknown,type:unknown="",lang:unknown="",version:unknown="",detail?:string):Entry|null{
  const clean=cleanId(id);
  const n=str(name,120);
  if(!clean||!n)return null;
  return {id:clean,name:n,type:str(type,30),lang:str(lang,15),version:str(version,60),...(detail?{detail:detail.slice(0,160)}:{})};
}
function unique(items:(Entry|null)[]):Entry[]{
  const seen=new Set<string>();
  return items.filter((x):x is Entry=>!!x&&!seen.has(x.id)&&!!seen.add(x.id)).slice(0,5000);
}
async function discover(kind:string,url:string):Promise<{name:string,items:Entry[]}>{
  const base=safeUrl(url).toString();
  if(kind==="stremio"){
    const raw=await loadJson(base.endsWith("/manifest.json")?base:join(base,"manifest.json"));
    const n=str(raw?.name);
    const item=one(raw?.id,n,"addon",(raw?.types||[]).join(",").slice(0,15),raw?.version,
      Array.isArray(raw?.catalogs)?raw.catalogs.length+" catalogs":"Stremio addon");
    if(!item)throw Error("Not a valid Stremio manifest.json");
    return {name:n,items:[item]};
  }
  if(kind==="cloudstream"){
    const manifest=await loadJson(base);
    if(!Array.isArray(manifest?.pluginLists))throw Error("CloudStream repo.json needs pluginLists URLs");
    const parts:any[]=[];
    for(const raw of manifest.pluginLists.slice(0,8)){
      if(typeof raw!=="string")continue;
      const plugins=await loadJson(raw);
      if(!Array.isArray(plugins))continue;
      parts.push(...plugins.slice(0,2000));
    }
    const items=unique(parts.map(p=>one(p?.internalName,p?.name||p?.internalName,"plugin",p?.language||p?.lang,p?.version, p?.description)));
    return {name:str(manifest?.name)||"CloudStream repository",items};
  }
  if(kind==="aniyomi"||kind==="mihon"){
    const normalized=base.replace(/\/(?:index\.min\.json|index\.json|index\.pb)\/?$/,"");
    let index:any;let lastError="";
    for(const candidate of [normalized+"/index.json",normalized+"/index.min.json"]){
      try{
        const r=await loadJson(candidate);
        if(Array.isArray(r)||Array.isArray(r?.extensionList?.extensions)){index=r;break;}
      }catch(e){lastError=String(e instanceof Error?e.message:e);}
    }
    if(!index)throw Error("No readable JSON extension index found. "+lastError);
    const rows=Array.isArray(index)?index:index.extensionList.extensions;
    const items=unique(rows.map((p:any)=>{
      const modern=!!p?.packageName;
      const pkg=modern?p.packageName:p?.pkg;
      const sources=Array.isArray(p?.sources)?p.sources:[];
      return one(pkg,p?.name||pkg,modern?"apk":"apk",
        modern?sources.map((s:any)=>str(s?.language)).filter(Boolean).slice(0,3).join(","):p?.lang,
        modern?p?.versionName:p?.version,
        sources.length?sources.length+" included source(s)":"Android extension APK");
    }));
    return {name:kind==="mihon"?"Mihon extensions":"Aniyomi extensions",items};
  }
  if(kind==="lnreader"){
    const index=await loadJson(base);
    if(!Array.isArray(index))throw Error("LNReader expects plugins.min.json array");
    return {name:"LNReader novels",items:unique(index.map((x:any)=>one(x?.id,x?.name,"novel",x?.lang,x?.version,x?.site)))};
  }
  if(kind==="zangetsu"){
    const index=await loadJson(base);
    if(!Array.isArray(index?.sources))throw Error("Zangetsu expects an index.json with sources[]");
    return {name:str(index.name)||"Zangetsu sources",items:unique(index.sources.map((x:any)=>
      one(x?.id,x?.name,x?.type,x?.lang,x?.version)))};
  }
  if(kind==="mangayomi"){
    const start=base.replace(/\/(?:anime_index\.json|manga_index\.json|index\.json|novel_index\.json)\/?$/,"");
    const targets=base.endsWith(".json")?[base]:[
      start+"/anime_index.json",start+"/manga_index.json",
      start+"/index.json",start+"/novel_index.json"
    ];
    const entries:Entry[]=[];let errorMessage="";
    for(const target of targets){
      try{
        const j=await loadJson(target);
        const rows=Array.isArray(j)?j:Array.isArray(j?.sources)?j.sources:Array.isArray(j?.extensions)?j.extensions:[];
        if(!rows.length)continue;
        for(const x of rows){
          if(!x||typeof x!=="object")continue;
          const id=Number.isSafeInteger(x.id) && Number.isInteger(x.itemType) &&
            Number.isInteger(x.sourceCodeLanguage)
            ? x.itemType+":"+x.sourceCodeLanguage+":"+x.id : null;
          // Match MangayomiSource.key's type/code-language/numeric-ID suffix.
          const type=["manga","anime","novel"][x.itemType]||"";
          const value=one(id,x.name||x.sourceName,type,
            x.lang||x.language,x.version,x.description);
          if(value)entries.push(value);
        }
      }catch(e){errorMessage=String(e instanceof Error?e.message:e);}
    }
    if(!entries.length)throw Error("No Mangayomi entries found: "+errorMessage);
    return {name:"Mangayomi sources",items:unique(entries)};
  }
  throw Error("Unsupported provider type");
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return respond({error:"POST required"},405);
  try{
    const token=req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if(!token)return respond({error:"Sign in required"},401);
    const {data:auth,error:authErr}=await admin.auth.getUser(token);
    if(authErr||!auth.user)return respond({error:"Session expired"},401);
    const {data:member,error:memberErr}=await admin.from("admin_members")
      .select("role,is_active").eq("user_id",auth.user.id).maybeSingle();
    if(memberErr||!member?.is_active||!["owner","admin"].includes(member.role))
      return respond({error:"Owner/admin access required"},403);
    const body=await req.json().catch(()=>null);
    if(!body||!allowedKinds.has(body.kind))return respond({error:"Invalid provider type"},400);
    const target=safeUrl(body.url).toString();
    const result=await discover(body.kind,target);
    return respond({ok:true,kind:body.kind,url:target,...result,total:result.items.length});
  }catch(e){
    const message=e instanceof Error?e.message:"Cannot read repository";
    return respond({error:message.slice(0,250)},400);
  }
});
