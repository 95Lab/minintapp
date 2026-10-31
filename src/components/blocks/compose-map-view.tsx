"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "../ui/component-notice";
export function ComposeMapView() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Địa điểm trên bản đồ")} />; }
