"use client";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandTopBar } from "@/engine-ui/brand-top-bar";
import { fetchAccountApps } from "@/engine/auth/account-client";
import { postHost } from "@/engine/api/api-client";
import { errorText } from "@/engine/api/app-error-codes";
import type { AccountAppsResponse, LifecycleRequest } from "@/engine/api/api-contract-types";
import { ACCOUNT_STRINGS } from "@/engine/i18n/account-strings-vi-en";
import styles from "./dashboard.module.css";

type Action = Extract<LifecycleRequest,{action:"extend"|"end"}>;
export function MyApps() {
 const {locale}=useLocale(),s=ACCOUNT_STRINGS[locale];
 const [data,setData]=useState<AccountAppsResponse|null>(null),[message,setMessage]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[expiry,setExpiry]=useState("all"),[sort,setSort]=useState("newest");
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const lock=useRef(false);
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const res=await fetchAccountApps();
   if(res.ok){setData(res);setSelected(old=>new Set([...old].filter(id=>res.apps.some(a=>a.id===id))));}
   else if(res.code==="sign_in_required")window.location.replace("/login");
   else setMessage(errorText(res.code,locale,res.params));
  }catch{setMessage(errorText("network",locale));}finally{setLoading(false);}
 },[locale]);
 useEffect(()=>{
  const claimed=Number(new URLSearchParams(window.location.search).get("claimed"));
  if(claimed>0){setMessage(s.claimedSome(claimed));history.replaceState(null,"",window.location.pathname);}
  void load();
 },[load,s]);
 const apps=data?.apps??[],now=Date.now(),soon=now+7*86400000;
 const isExpiring=(a:AccountAppsResponse["apps"][number])=>Date.parse(a.expiresAt)>now&&Date.parse(a.expiresAt)<=soon;
 const canExtend=(a:AccountAppsResponse["apps"][number])=>Date.parse(a.expiresAt)<Date.parse(a.maxExpiresAt);
 const normalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase(locale);
 const visible=apps.filter(a=>(status==="all"||a.status===status)&&(expiry==="all"||isExpiring(a))&&normalize(`${a.title} ${a.id}`).includes(normalize(query.trim())))
 .sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,locale):sort==="expiry"?Date.parse(a.expiresAt)-Date.parse(b.expiresAt):Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const chosen=visible.filter(a=>selected.has(a.id));
 const toggle=(id:string)=>setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});
 async function act(ids:string[],body:Action){
  if(lock.current||ids.length===0)return;
  if(body.action==="end"&&!window.confirm(s.batchEndConfirm(ids.length)))return;
  lock.current=true;setBusy(true);setMessage(null);
  const failed:string[]=[];const errors:string[]=[];
  try{
   // Bound request pressure; every mutation independently checks session ownership on the server.
   for(const id of ids){
    try{const res=await postHost(id,"lifecycle",null,body);if(!res.ok){failed.push(id);errors.push(errorText(res.code,locale,res.params));}}
    catch{failed.push(id);errors.push(errorText("network",locale));}
   }
   setSelected(new Set(failed));
   setMessage([s.batchResult(ids.length-failed.length,failed.length),...new Set(errors)].join("\n"));
   await load();
  }finally{lock.current=false;setBusy(false);}
 }
 const changeFilter=(setter:(v:string)=>void,value:string)=>{setter(value);setSelected(new Set());};
 const date=(value:string)=>new Date(value).toLocaleString(locale==="vi"?"vi-VN":"en-GB");
 return <><BrandTopBar/><main className={styles.dashboard} aria-busy={busy||loading}>
  <div className={styles.header}><div><h1>{s.myAppsTitle}</h1>{data&&<p className="muted">{s.signedInAs(data.email)}</p>}<p className="muted">{s.maxLifetimeNote}</p></div><div className="toolbar"><Link className="btn btn-primary" href="/templates">{s.createApp}</Link><button className="btn" disabled={busy||loading} onClick={()=>{setMessage(null);void load();}}>{s.refresh}</button></div></div>
  {message&&<div className={styles.notice} role="status">{message}</div>}
  {!data?loading?<p role="status">{s.loading}</p>:<button className="btn" onClick={()=>void load()}>{s.retry}</button>:<>
   <section className={styles.stats} aria-label={s.overview}>
    {[[s.totalApps,apps.length],[s.liveApps,apps.filter(a=>a.status==="active").length],[s.closedApps,apps.filter(a=>a.status==="closed").length],[s.expiringApps,apps.filter(isExpiring).length]].map(([label,count])=><div className={styles.stat} key={label}><span>{label}</span><strong>{count}</strong></div>)}
   </section>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><div className={styles.filters}>
    <label>{s.search}<input type="search" value={query} onChange={e=>changeFilter(setQuery,e.target.value)}/></label>
    <label>{s.statusFilter}<select value={status} onChange={e=>changeFilter(setStatus,e.target.value)}><option value="all">{s.all}</option><option value="active">{s.statusActive}</option><option value="closed">{s.statusClosed}</option></select></label>
    <label>{s.expiryFilter}<select value={expiry} onChange={e=>changeFilter(setExpiry,e.target.value)}><option value="all">{s.all}</option><option value="soon">{s.expiring}</option></select></label>
    <label>{s.sort}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">{s.newest}</option><option value="expiry">{s.expirySoon}</option><option value="title">{s.titleSort}</option></select></label>
   </div></fieldset>
   <p className={styles.count} aria-live="polite">{s.results(visible.length,apps.length)}</p>
   {visible.length>0&&<div className={styles.batch}>
    <label><input className={styles.check} type="checkbox" disabled={busy||loading} checked={chosen.length===visible.length} onChange={()=>setSelected(chosen.length===visible.length?new Set():new Set(visible.map(a=>a.id)))}/> {s.selectVisible}</label>
    <span aria-live="polite">{s.selected(chosen.length)}</span>
    <button className="btn" disabled={busy||loading||!chosen.some(canExtend)} onClick={()=>void act(chosen.filter(canExtend).map(a=>a.id),{action:"extend",by:"7d"})}>{s.extend7d}</button>
    <button className="btn btn-danger" disabled={busy||loading||!chosen.length} onClick={()=>void act(chosen.map(a=>a.id),{action:"end"})}>{s.endApp}</button>
    {selected.size>0&&<button className="btn" disabled={busy} onClick={()=>setSelected(new Set())}>{s.clearSelection}</button>}
    {busy&&<span role="status">{s.working}</span>}
   </div>}
   {visible.length===0?<div className={styles.empty}><p>{apps.length?s.noResults:s.myAppsEmpty}</p>{apps.length>0&&<button className="btn" onClick={()=>{setQuery("");setStatus("all");setExpiry("all");setSelected(new Set());}}>{s.resetFilters}</button>}</div>:<ul className={styles.list}>
    {visible.map(a=><li key={a.id} className={styles.row} data-testid="my-app"><input className={styles.check} type="checkbox" aria-label={s.selectApp(a.title)} checked={selected.has(a.id)} disabled={busy||loading} onChange={()=>toggle(a.id)}/><div className={styles.content}><h2>{a.title}</h2><div className={styles.meta}>{a.status==="closed"?s.statusClosed:s.statusActive} · {s.expiresAt} {date(a.expiresAt)}{!canExtend(a)&&<> · {s.atLimit}</>}</div><div className={styles.actions}><Link className="btn btn-primary" href={`/rooms/${a.id}/host`}>{s.openHost}</Link><button className="btn" disabled={busy||loading||!canExtend(a)} onClick={()=>void act([a.id],{action:"extend",by:"7d"})}>{s.extend7d}</button><button className="btn btn-danger" disabled={busy||loading} onClick={()=>void act([a.id],{action:"end"})}>{s.endApp}</button></div></div></li>)}
   </ul>}
  </>}
 </main></>;
}
