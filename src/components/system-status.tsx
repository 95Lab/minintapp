"use client";
import {useEffect,useState} from "react";
import {useLocale} from "@/lib/i18n/locale-provider";
import {toJapanese} from "@/lib/i18n/japanese";
import styles from "./system-status.module.css";
type State="checking"|"ok"|"unavailable"|"unknown";
export function SystemStatus(){
 const {locale, language, localize}=useLocale();
 const [state,setState]=useState<State>("checking");
 const [checkedAt,setCheckedAt]=useState<number|null>(null);
 useEffect(()=>{
  let active=true;
  let current:AbortController|null=null;
  async function check(){
   if(document.hidden)return;
   current?.abort();const controller=new AbortController();current=controller;
   const timeout=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetch("/api/health",{cache:"no-store",signal:controller.signal});
    const body=await response.json();
    if(active&&current===controller){setState(response.ok&&body.status==="ok"?"ok":body.status==="unavailable"?"unavailable":"unknown");setCheckedAt(Date.now());}
   }catch{if(active&&current===controller){setState("unknown");setCheckedAt(Date.now());}}
   finally{clearTimeout(timeout);}
  }
  void check();const timer=setInterval(()=>void check(),60000);
  const visible=()=>{if(!document.hidden)void check();};
  document.addEventListener("visibilitychange",visible);
  return()=>{active=false;clearInterval(timer);current?.abort();document.removeEventListener("visibilitychange",visible);};
 },[]);
 const vi=locale==="vi";
 const labels=vi?{checking:"Đang kiểm tra hệ thống…",ok:"Hệ thống hoạt động bình thường",unavailable:"Hệ thống tạm thời gián đoạn",unknown:"Chưa thể xác nhận trạng thái hệ thống"}:{checking:"Checking system status…",ok:"System operating normally",unavailable:"System temporarily unavailable",unknown:"Unable to confirm system status"};
 return <div className={styles.status} data-state={state}>
  <div><p className={styles.label}>{localize("TRẠNG THÁI HỆ THỐNG","SYSTEM STATUS")}</p><p className={styles.message} role="status"><span className={styles.dot} aria-hidden="true"/>{language==="ja"?toJapanese(labels[state]):labels[state]}</p><p className={styles.note}>{checkedAt?<>{localize("Kiểm tra lúc ","Checked at ")}<time dateTime={new Date(checkedAt).toISOString()}>{new Date(checkedAt).toLocaleTimeString(language==="ja"?"ja-JP":localize("vi-VN","en-GB"),{hour:"2-digit",minute:"2-digit"})}</time>{localize(" · Tự cập nhật mỗi phút"," · Updates every minute")}</>:localize("Đang lấy trạng thái mới nhất của nền tảng.","Getting the latest platform status.")}</p></div>
 </div>;
}
