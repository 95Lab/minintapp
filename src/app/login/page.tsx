import { getLocale } from "@/lib/i18n/server";
import { LoginForm } from "@/engine-ui/account/login-form";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: locale === "en" ? "Sign in · MinintApp" : "Đăng nhập · MinintApp", referrer: "no-referrer" as const };
}

export default function LoginPage() {
  return <LoginForm />;
}
