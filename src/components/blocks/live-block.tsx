"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "../ui/component-notice";
export function LiveBlock() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Dữ liệu trực tiếp")} />; }
