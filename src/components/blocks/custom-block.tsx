"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "../ui/component-notice";
export function CustomBlock() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Nội dung tùy biến")} />; }
