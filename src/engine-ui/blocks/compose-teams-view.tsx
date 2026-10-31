"use client";
// Teams view: before the draw, how many people joined; after, one card per team (drawn on the server)
// and anyone who joined after the draw.
import type { ComposeViewResult } from "@/engine/api/api-contract-types";
import { t, type UiLocale } from "@/engine/i18n/ui-strings-vi-en";

type TeamsView = Extract<ComposeViewResult, { kind: "teams" }>;

export function ComposeTeamsView({ view, locale }: { view: TeamsView; locale: UiLocale }) {
  const s = t(locale);
  if (!view.teams) {
    return (
      <p className="muted num" style={{ margin: 0 }}>
        {s.composeNotDrawn} {s.composeJoinedCount(view.joined)}
      </p>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="compose-teams">
        {view.teams.map((team, i) => (
          <div key={i} className="compose-group">
            <div className="compose-group-head">
              <span>{s.composeTeamName(i + 1)}</span>
              <span className="num muted">{team.members.length}</span>
            </div>
            <div className="compose-names">
              {team.members.map((m, i) => (
                <span key={i} className="chip">{m}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {view.waiting.length > 0 && (
        <div className="muted" style={{ fontSize: 13 }}>
          {s.composeWaitingTeam}: {view.waiting.join(", ")}
        </div>
      )}
    </div>
  );
}
