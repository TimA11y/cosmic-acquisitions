// Save/resume support: converting gameState to/from a JSON string. Most of
// gameState is already plain data that JSON.stringify/parse handle natively;
// the two exceptions are `board` (a Map) and each corporation's `sectors`
// (a Set), neither of which survives a JSON round-trip on its own. See
// docs/persistence-design.md.

/** Serializes a gameState to a JSON string suitable for localStorage. */
export function serialize(gameState) {
  const plainCorporations = Object.fromEntries(
    Object.entries(gameState.corporations).map(([id, corporation]) => [
      id,
      { ...corporation, sectors: [...corporation.sectors] },
    ]),
  );

  return JSON.stringify({
    ...gameState,
    board: Object.fromEntries(gameState.board),
    corporations: plainCorporations,
  });
}

/** Restores a gameState from a JSON string produced by serialize(). */
export function deserialize(json) {
  const parsed = JSON.parse(json);

  const corporations = Object.fromEntries(
    Object.entries(parsed.corporations).map(([id, corporation]) => [
      id,
      { ...corporation, sectors: new Set(corporation.sectors) },
    ]),
  );

  return {
    ...parsed,
    board: new Map(Object.entries(parsed.board)),
    corporations,
  };
}
