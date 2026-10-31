import Link from "next/link";
import styles from "./site-header.module.css";
/** The homepage wordmark is the single brand source across the platform. */
export function BrandLogo({ className = "", label = "MinintApp" }: { className?: string; label?: string }) {
  return <Link href="/" className={`${styles.logo} ${className}`} aria-label={label}>
    <span className={styles.mark} aria-hidden="true">m<span>·</span></span>
    <span>minintapp<span className={styles.period}>.</span></span>
  </Link>;
}
