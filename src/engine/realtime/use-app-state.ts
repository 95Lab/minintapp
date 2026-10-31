"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {AppStateResponse,GoneResponse} from "@/engine/api/api-contract-types";
import {fetchState} from "@/engine/api/api-client";
import {startStateSync} from "@/lib/realtime/state-sync";
import {subscribeToApp} from "@/lib/realtime/supabase-subscription";
import type {AppSync} from "@/lib/api/api-contract-types";
export function useAppState(id:string,tokens:{host?:string|null;participant?:string|null},opts:{intervalMs:number;followMove:boolean;enabled?:boolean;minRefetchMs?:number;audience:"host"|"participant"}) {
 const router=useRouter(); const [state,setState]=useState<(AppStateResponse & {sync?:AppSync})|null>(null);const[gone,setGone]=useState<GoneResponse|null>(null);const[offline,setOffline]=useState(false);
 const host=tokens.host,participant=tokens.participant,enabled=opts.enabled??true;
 const apply=useCallback((next:AppStateResponse)=>{setState(old=>!old||old.id!==next.id||old.stateVersion<=next.stateVersion?next:old);},[]);
 const refresh=useCallback(async()=>{const r=await fetchState(id,{host,participant});if(r.kind==="ok"){apply(r.state);setOffline(false);}else if(r.kind==="gone")setGone(r.gone);else if(r.kind==="error")setOffline(true);return r.kind!=="error";},[id,host,participant,apply]);
 useEffect(()=>{if(enabled)void refresh();},[enabled,refresh]);
 const sync=state?.sync;const mode=sync?.mode,url=sync?.mode==="supabase"?sync.url:"",publicKey=sync?.mode==="supabase"?sync.publicKey:"",channel=sync?.mode==="supabase"?sync.channel:"";
 useEffect(()=>{if(!enabled||gone)return;return startStateSync({sync:mode==="supabase"?{mode,url,publicKey,channel}:{mode:"memory"},refresh,subscribe:subscribeToApp,events:window});},[enabled,!!gone,mode,url,publicKey,channel,refresh]);
 useEffect(()=>{if(!enabled||!state||gone)return;const delay=Math.max(50,Math.min(2147483647,Date.parse(state.expiresAt)-Date.now()+50));const timer=setTimeout(()=>void refresh(),delay);return()=>clearTimeout(timer);},[enabled,state?.expiresAt,!!gone,refresh]);
 useEffect(()=>{if(!enabled||!state?.spec.blocks.some(b=>b.type==="live")||gone)return;const timer=setInterval(()=>void refresh(),300000);return()=>clearInterval(timer);},[enabled,state?.spec,!!gone,refresh]);
 useEffect(()=>{if(opts.followMove&&state?.movedTo)router.replace(`/rooms/${state.movedTo}`);},[opts.followMove,state?.movedTo,router]);
 return{state,gone,offline,live:mode==="supabase"&&!offline,refresh:async()=>{await refresh();},apply};
}
