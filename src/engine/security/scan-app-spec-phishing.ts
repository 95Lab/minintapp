// Regex-based phishing/credential-harvesting scan over a generated AppSpec (T2 in the threat
// model). Combines with moderatePrompt (input-side) and the model's own riskFlags to catch what
// moderation alone would miss. Block text comes from each brick's `security` hooks (registry), so
// new bricks are scanned without changes here.
//
// ok=false only for HIGH-CONFIDENCE signals; everything else is recorded in `issues` for visibility
// but does not block generation, so an honest quiz *about* password safety is never refused.
import type { AppSpec } from "@/engine/app-spec/app-spec-schema";
import { blockDefinition } from "@/engine/blocks/block-registry";
import { ACCOUNT_NUMBER_REGEX, hasBankOrWalletBrand, hasCredentialAction, hasCredentialNoun, hasLoginOrPrizeWording, hasTransferInstruction, URL_LIKE_REGEX } from "./phishing-keywords-vi-en";

export function scanAppSpecPhishing(spec: AppSpec, riskFlags: string[]): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  let highConfidence = false;
  const flag = (issue: string) => {
    issues.push(issue);
    highConfidence = true;
  };

  // Model self-reported risk (combined with, never a substitute for, the rules below).
  for (const f of riskFlags) if (f !== "none") flag(`model_risk_flag:${f}`);

  const allText: string[] = [spec.title, spec.description ?? ""];
  for (const block of spec.blocks) {
    const sec = blockDefinition(block.type).security;
    // Rule 1a: anything participants TYPE into must not ask for credentials.
    if (sec.inputLabels(block).some((t) => hasCredentialNoun(t))) flag(`credential_input:${block.id}`);
    // Rule 1b: instructions/questions telling people to enter/send credentials.
    if (sec.instructionTexts(block).some((t) => hasCredentialAction(t))) flag(`credential_instruction:${block.id}`);
    // Low-confidence: e.g. quiz options like "Share your password with IT" (a legit wrong answer).
    const texts = sec.allTexts(block);
    if (texts.some((t) => hasCredentialAction(t))) issues.push(`credential_wording_low_confidence:${block.id}`);
    allText.push(...texts);
  }

  // Rule 2: bank/wallet brand + login/prize wording, scoped to title/description only.
  const titleAndDescription = `${spec.title} ${spec.description ?? ""}`;
  const hasBrand = hasBankOrWalletBrand(titleAndDescription);
  if (hasBrand && hasLoginOrPrizeWording(titleAndDescription)) flag("brand_login_or_prize_wording");
  else if (hasBrand) issues.push("brand_mention_low_confidence");

  // Rule 3: any URL/domain-like text, anywhere in the spec.
  if (allText.some((t) => URL_LIKE_REGEX.test(t))) flag("url_like_text");

  // Rule 4: an account / card number in generated text (the payee form is the only way a bank account
  // enters an app). High confidence when it sits next to bank / transfer / account wording or in the title or
  // description; a bare long number elsewhere (a quiz option like "123456789") is only recorded.
  const hasNumber = (text: string) => ACCOUNT_NUMBER_REGEX.test(text);
  if (allText.some((x) => hasNumber(x) && (hasTransferInstruction(x) || hasBankOrWalletBrand(x) || hasCredentialNoun(x))) || hasNumber(titleAndDescription)) flag("account_number_like_text");
  else if (allText.some(hasNumber)) issues.push("long_number_low_confidence");
  else if (allText.some((x) => hasTransferInstruction(x))) issues.push("transfer_wording_low_confidence");

  if (!highConfidence && allText.some((t) => hasCredentialNoun(t))) issues.push("credential_word_mention_low_confidence");
  return { ok: !highConfidence, issues: Array.from(new Set(issues)) };
}
