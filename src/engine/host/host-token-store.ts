// Host secrets live in HttpOnly cookies. This module retains only a tab-scoped token
// during a creation response and a non-secret list of room IDs for account claiming.
const tokens=new Map<string,string>();
export const getHostToken=(id:string)=>tokens.get(id)??null;
export function setHostToken(id:string,token:string){tokens.set(id,token);try{localStorage.setItem(`minint:owned:${id}`,"1");}catch{}}
export function captureHostTokenFromHash(id:string){return getHostToken(id);}
export function allHostTokens():Array<{id:string;hostToken:string}>{try{return Object.keys(localStorage).filter(k=>k.startsWith("minint:owned:")).map(k=>({id:k.slice("minint:owned:".length),hostToken:tokens.get(k.slice("minint:owned:".length))??""}));}catch{return[];}}
