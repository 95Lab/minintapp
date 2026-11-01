import {SiteHeader} from "@/components/site-header";
import {getLanguage} from "@/lib/i18n/server";
import {HowItWorksClient} from "./how-it-works-client";
export async function generateMetadata(){const language=await getLanguage();return {title:language==="ja"?"使い方 · MinintApp":language==="en"?"How it works · MinintApp":"Cách hoạt động · MinintApp"};}
export default function HowItWorksPage(){return <><SiteHeader/><HowItWorksClient/></>;}
