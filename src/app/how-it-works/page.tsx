import "@/components/runtime-design.css";
import {SiteHeader} from "@/components/site-header";
import {HowItWorks} from "@/components/create/how-it-works";
import {getLocale} from "@/lib/i18n/server";
import {composeSpec,quizSpec} from "@/lib/app-spec/app-spec-examples";
import {stripPrivateFields} from "@/lib/app-spec/strip-private-fields";
import {initialRuntime} from "@/lib/blocks/block-definition-types";
import {ComponentPreview} from "../preview/preview-client";
import styles from "./page.module.css";
export default async function HowItWorksPage(){
 const locale=await getLocale();const runtime=initialRuntime();runtime.openQuestionId="q1";
 const spec={...composeSpec(),title:"Ứng dụng mẫu",layout:"tabs" as const,blocks:[...composeSpec().blocks,...quizSpec().blocks]};
 return <><SiteHeader/><main className={styles.main}><HowItWorks locale={locale}/><div id="live-demo" className={styles.demo}><ComponentPreview embedded spec={stripPrivateFields(spec,runtime)} runtime={runtime}/></div></main></>;
}
