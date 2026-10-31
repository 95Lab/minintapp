// Browser identity is private to each app. A cleared browser creates a new participant.
export function getParticipantToken(appId: string): string {
  const key = `minint_participant_${appId}`;
  const current = localStorage.getItem(key);
  if (current && /^[a-f0-9]{64}$/.test(current)) return current;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(key, token);
  return token;
}
