"use client";
import { useEffect } from "react";
export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll("[data-reveal], .reveal-word").forEach((element) => { element.classList.add("will-reveal"); observer.observe(element); });
    return () => observer.disconnect();
  }, []);
  return null;
}
