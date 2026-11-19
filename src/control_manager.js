// Identical button IDs and placement invariants to AnimePlex player_controls_config.dart.
export const PLAYER_CONTROLS = [
  ['speed','Speed','gauge'],['tracks','Audio & subs','subtitles'],
  ['quality','Quality','monitor'],['sources','Sources','layers'],
  ['more','More','menu'],['episodes','Episodes','film'],
  ['fit','Aspect ratio','maximize'],['rotate','Portrait','rotate-cw'],
  ['cast','Cast','cast'],['info','Playback stats','info'],
  ['decoder','Decoder','cpu'],['enhance','Anime4K','spark'],
  ['colour','Colour','palette'],['snapshot','Snapshot','camera'],
  ['sleep','Sleep timer','moon'],['pip','Picture-in-picture','picture-in-picture'],
].map(([id,label,icon])=>({id,label,icon,pinned:id==='more'}));

export const PLAYER_IDS = PLAYER_CONTROLS.map(item=>item.id);
export const PLAYER_SLOTS = ['top','left','right','hidden'];
export const REGION_CODES = ['IN','US','GB','CA','AU','DE','FR','ES','IT','BR','MX','JP','KR','SG','AE','ZA','NL','SE','PL','ID'];
export const REGION_NAMES = {IN:'India',US:'United States',GB:'United Kingdom',CA:'Canada',
  AU:'Australia',DE:'Germany',FR:'France',ES:'Spain',IT:'Italy',BR:'Brazil',
  MX:'Mexico',JP:'Japan',KR:'South Korea',SG:'Singapore',AE:'United Arab Emirates',
  ZA:'South Africa',NL:'Netherlands',SE:'Sweden',PL:'Poland',ID:'Indonesia'};
export const DEFAULT_PLAYER_LAYOUT = Object.freeze({
  top:['cast','info'],
  left:['speed','tracks','quality','sources','more'],
  right:['episodes','rotate','fit'],
});

export function cleanPlayerLayout(raw) {
  const source=raw && typeof raw==='object' ? raw : DEFAULT_PLAYER_LAYOUT;
  const used=new Set();
  const output={top:[],left:[],right:[]};
  for(const slot of ['top','left','right']){
    const values=Array.isArray(source[slot]) ? source[slot] : DEFAULT_PLAYER_LAYOUT[slot];
    for(const id of values) {
      if(!PLAYER_IDS.includes(id) || used.has(id) ||
        (slot==='top' && output.top.length>=5)) continue;
      output[slot].push(id);used.add(id);
    }
  }
  // More is pinned. It must never end up hidden: it is the path to hidden controls.
  if(!used.has('more')) output.left.push('more');
  return output;
}

export function hiddenPlayerControls(layout) {
  const used=new Set([...layout.top,...layout.left,...layout.right]);
  return PLAYER_IDS.filter(id=>!used.has(id));
}

export function movePlayerControl(layout,id,slot,beforeId=null) {
  const current=cleanPlayerLayout(layout);
  if(!PLAYER_IDS.includes(id) || !PLAYER_SLOTS.includes(slot) ||
     (id==='more' && slot==='hidden')) return current;
  const result={top:[...current.top],left:[...current.left],right:[...current.right]};
  for(const lane of ['top','left','right']){
    result[lane]=result[lane].filter(item=>item!==id);
  }
  if(slot!=='hidden'){
    if(slot==='top' && result.top.length>=5){
      return current; // top bar must preserve room for the title
    }
    const target=result[slot];
    const before=beforeId ? target.indexOf(beforeId) : -1;
    if(before>=0)target.splice(before,0,id);
    else target.push(id);
  }
  return cleanPlayerLayout(result);
}

export function reorderPlayerControl(layout,id,direction) {
  const result=cleanPlayerLayout(layout);
  const slot=['top','left','right'].find(k=>result[k].includes(id));
  if(!slot || ![-1,1].includes(direction)) return result;
  const index=result[slot].indexOf(id),to=index+direction;
  if(to<0||to>=result[slot].length)return result;
  [result[slot][index],result[slot][to]]=[result[slot][to],result[slot][index]];
  return result;
}

export function validatePlayerLayout(layout) {
  const cleaned=cleanPlayerLayout(layout);
  const slots=['top','left','right'];
  return slots.every(slot=>Array.isArray(layout?.[slot]) &&
    cleaned[slot].length===layout[slot].length &&
    cleaned[slot].every((v,i)=>v===layout[slot][i]));
}
