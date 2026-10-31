"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "../ui/component-notice";
export function ComposeSettleView() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Quyết toán và thanh toán")} />; }
