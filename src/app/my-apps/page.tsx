import { MyApps } from "@/engine-ui/account/my-apps";

export const metadata = { title: "App của tôi · MinintApp", referrer: "no-referrer" as const };

export default function MyAppsPage() {
  return <MyApps />;
}
