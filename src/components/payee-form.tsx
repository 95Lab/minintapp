"use client";
import { useRuntimeTranslation } from "@/lib/i18n/runtime-locale";
import { ComponentNotice } from "./ui/component-notice";
export function PayeeForm() {
  const tr = useRuntimeTranslation(); return <ComponentNotice title={tr("Tài khoản nhận thanh toán")}>{tr("Thanh toán chưa khả dụng. Không nhập thông tin tài khoản ở bước này.")}</ComponentNotice>; }
