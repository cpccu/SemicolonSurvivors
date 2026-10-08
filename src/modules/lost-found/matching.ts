import type { LiveItem } from "@/modules/community/models";

const tokens = (text: string) => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
const ignored = new Set(["with", "this", "that", "found", "lost", "item", "near", "the", "and", "from"]);
export function suggestMatches(item: LiveItem, candidates: LiveItem[]) {
  const words = tokens(`${item.title} ${item.description}`);
  return candidates.filter((candidate) => candidate.id !== item.id && candidate.kind !== item.kind && candidate.state === "open").map((candidate) => {
    const candidateWords = tokens(`${candidate.title} ${candidate.description}`);
    const overlap = [...words].filter((word) => !ignored.has(word) && candidateWords.has(word)).slice(0, 6);
    const reasons = overlap.length ? [`Shared description words: ${overlap.join(", ")}`] : [];
    const sameLocation = candidate.location.toLocaleLowerCase() === item.location.toLocaleLowerCase();
    const days = Math.abs(Date.parse(candidate.occurred_on) - Date.parse(item.occurred_on)) / 86_400_000;
    if (sameLocation) reasons.push("Same reported location");
    if (days <= 3) reasons.push("Dates within three days");
    return { item: candidate, reasons, score: overlap.length * 2 + Number(sameLocation) * 2 + Number(days <= 3) };
  }).filter((match) => match.score >= 3).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)).slice(0, 5);
}
