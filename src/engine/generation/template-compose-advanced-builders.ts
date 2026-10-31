// Keyword-mock builders for the richer compose apps (used when no LLM key is configured): expense
// log, leader vote, random teams, host-paced quick questions. EN variants are shared with templates.
import type { AppSpecDraft, Locale } from "@/engine/app-spec/app-spec-schema";
import { exampleExpenseLog, exampleLeaderVote, exampleRandomTeams, exampleRsvp, exampleStepSurvey } from "@/engine/app-spec/app-spec-examples-compose-advanced";

export const EXPENSE_LOG_INTENT = /(sổ chi tiêu|so chi tieu|ghi (từng|các) khoản|expense log|track expenses)/i;
export const LEADER_VOTE_INTENT = /(bầu (ai|trưởng|lớp trưởng|nhóm trưởng)|bau truong|vote (a|the) (leader|person)|elect)/i;
export const TEAMS_INTENT = /(chia\s+(\d+\s+)?(đội|nhóm|team)|chia doi|random teams?|split into \d* ?teams|make \d* ?teams)/i;
export const STEPS_INTENT = /(từng câu|tung cau|mở từng|one question at a time|host opens each)/i;
export const RSVP_INTENT = /(xác nhận tham (dự|gia)|rsvp|có đi không|who is coming)/i;

type Block = Extract<AppSpecDraft["blocks"][number], { type: "compose" }>;
const firstCompose = (spec: AppSpecDraft) => spec.blocks[0] as Block;

export function buildExpenseLog(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleExpenseLog);
  if (locale === "en") {
    const b = firstCompose(spec);
    Object.assign(spec, { locale, title: "Trip expense log", description: "Log each expense; the app adds it up and settles who pays whom." });
    Object.assign(b, { title: "Add an expense", note: "One line per expense; edit or remove anytime." });
    b.inputs[0].label = "Amount";
    b.inputs[1].label = "What for";
    b.views[0].title = "Who pays whom";
    b.views[1].title = "All expenses";
  }
  return spec;
}

export function buildLeaderVote(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleLeaderVote);
  if (locale === "en") {
    const b = firstCompose(spec);
    Object.assign(spec, { locale, title: "Vote for a team lead", description: "Pick someone in the room; results show after you vote." });
    b.title = "Who should lead the team?";
    b.inputs[0].label = b.title;
  }
  return spec;
}

export function buildTeams(prompt: string, locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleRandomTeams);
  const b = firstCompose(spec);
  const n = Number(prompt.match(/(\d{1,2})\s*(đội|nhóm|team)/i)?.[1]);
  if (n >= 2 && n <= 20) b.views[0].teams = n;
  if (locale === "en") {
    Object.assign(spec, { locale, title: "Random teams", description: `Everyone joins, the host deals ${b.views[0].teams} teams.` });
    Object.assign(b, { title: "Teams", note: "Opening the app puts you on the list." });
    b.views[0].title = "Teams";
  } else {
    spec.description = `Mọi người vào app, host bấm chia ${b.views[0].teams} đội.`;
  }
  return spec;
}

export function buildStepSurvey(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleStepSurvey);
  if (locale === "en") {
    const b = firstCompose(spec);
    Object.assign(spec, { locale, title: "Quick questions, one at a time", description: "The host opens each question for 20 seconds; results show when it closes." });
    b.title = "Quick questions";
    b.inputs[0].label = "When do you work best?";
    b.inputs[0].options = [
      { id: "sang", label: "Morning", price: null },
      { id: "chieu", label: "Afternoon", price: null },
      { id: "dem", label: "Night", price: null },
    ];
    b.inputs[1].label = "How was your week?";
    b.views[0].title = "Best time";
    b.views[1].title = "This week";
  }
  return spec;
}

export function buildRsvp(locale: Locale): AppSpecDraft {
  const spec = structuredClone(exampleRsvp);
  if (locale === "en") {
    const b = firstCompose(spec);
    Object.assign(spec, { locale, title: "RSVP: year-end party", description: "Coming? Pick the day and how many guests; not coming? Tell us why." });
    b.title = "Are you coming?";
    const [going, day, guests, why] = b.inputs;
    going.label = b.title;
    going.options = [
      { id: "yes", label: "Yes", price: null },
      { id: "no", label: "No", price: null },
    ];
    day.label = "Which day";
    guests.label = "Guests with you";
    why.label = "Why not (optional)";
    b.views[0].title = "Coming";
    b.views[1].title = "By day";
    b.views[2].title = "Guest list";
  }
  return spec;
}
