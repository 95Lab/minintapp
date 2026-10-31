"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "../ui/component-notice";
export function ComposePlaceField() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Chọn địa điểm")} />; }
