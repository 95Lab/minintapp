"use client";
// Email magic-link authentication; visual changes do not change the auth API contract.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { requestMagicLink } from "@/engine/auth/account-client";
import { errorText } from "@/engine/api/app-error-codes";
import { ACCOUNT_STRINGS, savedUiLocale } from "@/engine/i18n/account-strings-vi-en";
import styles from "./login-form.module.css";

const copy = {
  vi: {
    back: "Về trang chủ", skip: "Đến phần đăng nhập", eyebrow: "KHÔNG GIAN CỦA BẠN",
    headline: <>Ý tưởng hôm nay.<br />Giữ lại cho <span>ngày mai.</span></>,
    intro: "Một nơi để quản lý những ứng dụng nhỏ, cho những khoảnh khắc có cả nhóm.",
    benefit: "Tạo hôm nay, mở lại khi cần", detail: "Đăng nhập để tìm lại app của bạn và quản lý trên các thiết bị.",
    illustration: "Minh họa không gian ứng dụng", workspace: "Ứng dụng của bạn", sample: "Ví dụ minh họa",
    poll: "Cả nhóm cùng chọn", pollType: "Bình chọn", quiz: "Một chút thử thách", quizType: "Quiz",
    label: "CHÀO MỪNG BẠN QUAY LẠI", title: "Một email là đủ.", lead: "Nhận link đăng nhập qua email. Không cần nhớ thêm mật khẩu.",
    placeholder: "ban@example.com", privacy: "Chỉ dùng email để gửi liên kết đăng nhập.",
    participant: "Chỉ muốn tham gia một app?", participantNote: "Mở link được chia sẻ, bạn không cần tài khoản.",
    sentLabel: "BƯỚC TIẾP THEO", sentEmail: "Email bạn đã nhập", sentHelp: "Chưa thấy thư? Kiểm tra mục spam hoặc nhập lại địa chỉ email.",
    retry: "Đổi email hoặc gửi lại", footer: "Một sản phẩm từ 95LAB.", tagline: "Ứng dụng nhỏ. Đúng lúc cần.",
  },
  en: {
    back: "Back to home", skip: "Skip to sign in", eyebrow: "YOUR OWN SPACE",
    headline: <>Today’s ideas.<br />Ready for <span>tomorrow.</span></>,
    intro: "A place for your small apps and the moments that bring everyone together.",
    benefit: "Create today, come back when you need", detail: "Sign in to find your apps and manage them across devices.",
    illustration: "Illustration of your app workspace", workspace: "Your apps", sample: "Illustrative example",
    poll: "Let the group decide", pollType: "Poll", quiz: "A little challenge", quizType: "Quiz",
    label: "WELCOME BACK", title: "One email is all it takes.", lead: "Get a sign-in link in your inbox. No extra password to remember.",
    placeholder: "you@example.com", privacy: "Your email is used to send the sign-in link.",
    participant: "Just joining an app?", participantNote: "Open the shared link. You don’t need an account.",
    sentLabel: "YOUR NEXT STEP", sentEmail: "The email you entered", sentHelp: "No email yet? Check your spam folder or check the address you entered.",
    retry: "Change email or try again", footer: "Made by 95LAB.", tagline: "Small apps. Right when you need them.",
  },
};

export function LoginForm() {
  const [locale, setLocale] = useState<"vi" | "en">("vi");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setLocale(savedUiLocale()), []);
  useEffect(() => { if (sent) sentHeading.current?.focus(); }, [sent]);
  const s = ACCOUNT_STRINGS[locale], c = copy[locale];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError(null);
    const res = await requestMagicLink(email.trim());
    if (res.ok) setSent(true);
    else setError(errorText(res.code, locale, res.params));
    setBusy(false);
  }

  return <div className={styles.shell} lang={locale}>
    <a className={styles.skip} href="#login-content">{c.skip}</a>
    <header className={styles.header}>
      <Link href="/" className={styles.logo} aria-label="MinintApp"><span className={styles.mark} aria-hidden="true">m·</span>minintapp<span className={styles.period}>.</span></Link>
      <div className={styles.headerActions}><button className={styles.language} type="button" aria-label={locale === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"} onClick={() => {
        const next = locale === "vi" ? "en" : "vi"; setLocale(next); setError(null);
        try { localStorage.setItem("minint:ui-locale", next); } catch { /* A blocked storage does not prevent changing this page. */ }
      }}>{locale === "vi" ? "EN" : "VI"}</button><Link className={styles.back} href="/"><span aria-hidden="true">←</span>{c.back}</Link></div>
    </header>
    <main id="login-content" className={styles.main}>
      <aside className={styles.story} aria-label={c.tagline}>
        <p className={styles.eyebrow}><span className={styles.dot} />{c.eyebrow}</p>
        <h2 className={styles.headline}>{c.headline}</h2>
        <p className={styles.intro}>{c.intro}</p>
        <div className={styles.workspace} role="img" aria-label={c.illustration}>
          <div className={styles.workspaceHeader}><span className={styles.workspaceMark} aria-hidden="true">✳</span><span>{c.workspace}</span><span className={styles.sample}>{c.sample}</span></div>
          <div className={styles.appRow}><span className={styles.appIcon} aria-hidden="true">≡</span><div><strong>{c.poll}</strong><span>{c.pollType}</span></div><span className={styles.appArrow} aria-hidden="true">↗</span></div>
          <div className={styles.appRow}><span className={styles.appIcon} aria-hidden="true">✳</span><div><strong>{c.quiz}</strong><span>{c.quizType}</span></div><span className={styles.appArrow} aria-hidden="true">↗</span></div>
        </div>
        <div className={styles.benefit}><span aria-hidden="true">↳</span><div><strong>{c.benefit}</strong><p>{c.detail}</p></div></div>
      </aside>
      <div className={styles.formSide}>
        <section className={styles.card} aria-labelledby="login-title">
          <span className={styles.mailIcon} aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></svg></span>
          <p className={styles.eyebrow}>{sent ? c.sentLabel : c.label}</p>
          {sent ? <div className={styles.sent} role="status">
            <h1 id="login-title" ref={sentHeading} tabIndex={-1} className={styles.title}>{s.checkEmail}</h1>
            <p className={styles.lead}>{s.checkEmailLead}</p>
            <div className={styles.emailReceipt}><span>{c.sentEmail}</span><strong>{email.trim()}</strong></div>
            <p className={styles.hint}>{c.sentHelp}</p>
            <button className={styles.submit} type="button" onClick={() => { setSent(false); setError(null); }}>{c.retry}<span aria-hidden="true">↗</span></button>
          </div> : <>
            <h1 id="login-title" className={styles.title}>{c.title}</h1>
            <p className={styles.lead}>{c.lead}</p>
            <form onSubmit={submit} className={styles.form} aria-busy={busy}>
              <label htmlFor="login-email">{s.emailLabel}</label>
              <input id="login-email" className={styles.input} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder={c.placeholder} value={email} disabled={busy} aria-invalid={!!error} aria-describedby={error ? "login-error login-privacy" : "login-privacy"} onChange={e => { setEmail(e.target.value); if (error) setError(null); }} />
              {error && <p id="login-error" className={styles.error} role="alert">{error}</p>}
              <button className={styles.submit} type="submit" disabled={busy || !email.trim()}>{busy ? s.sending : s.sendLink}<span aria-hidden="true">↗</span></button>
              <p id="login-privacy" className={styles.privacy}>{c.privacy}</p>
            </form>
          </>}
        </section>
        <p className={styles.participant}><strong>{c.participant}</strong><br />{c.participantNote}</p>
      </div>
    </main>
    <footer className={styles.footer}><span>{c.footer}</span><span>{c.tagline}</span></footer>
  </div>;
}
