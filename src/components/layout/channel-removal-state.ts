export type HiddenSourceIdsAction =
  | { type: "hide"; sourceId: string }
  | { type: "show"; sourceId: string }
  | { type: "prune"; sourceIds: readonly string[] };

export function hiddenSourceIdsReducer(
  current: ReadonlySet<string>,
  action: HiddenSourceIdsAction,
): ReadonlySet<string> {
  if (action.type === "hide") return new Set(current).add(action.sourceId);
  if (action.type === "show") {
    const next = new Set(current);
    next.delete(action.sourceId);
    return next;
  }
  return new Set([...current].filter((sourceId) => action.sourceIds.includes(sourceId)));
}
