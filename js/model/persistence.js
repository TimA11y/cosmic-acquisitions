// Save/resume support: converting gameState to/from a JSON string. Most of
// gameState is already plain data that JSON.stringify/parse handle natively;
// the two exceptions are `board` (a Map) and each corporation's `sectors`
// (a Set), neither of which survives a JSON round-trip on its own. See
// docs/persistence-design.md.

// Bumped whenever gameState's shape changes in a way that would make an
// older save unsafe to load as-is. deserialize() rejects anything that
// doesn't match, so callers (js/ui/storage.js) can treat an incompatible
// old save the same as "no save exists" instead of crashing on it.
const SCHEMA_VERSION = 1;

/** Serializes a gameState to a JSON string suitable for localStorage. */
export function serialize(gameState) {
  const plainCorporations = Object.fromEntries(
    Object.entries(gameState.corporations).map(([id, corporation]) => [
      id,
      { ...corporation, sectors: [...corporation.sectors] },
    ]),
  );

  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    ...gameState,
    board: Object.fromEntries(gameState.board),
    corporations: plainCorporations,
  });
}

/**
 * Restores a gameState from a JSON string produced by serialize(). Throws
 * if the save's schemaVersion doesn't match the current one — a stale save
 * from a shape this code no longer understands should fail loudly here,
 * not produce a subtly-broken gameState downstream.
 */
export function deserialize(json) {
  const parsed = JSON.parse(json);

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Save schema version mismatch: expected ${SCHEMA_VERSION}, got ${parsed.schemaVersion}.`,
    );
  }

  const corporations = Object.fromEntries(
    Object.entries(parsed.corporations).map(([id, corporation]) => [
      id,
      { ...corporation, sectors: new Set(corporation.sectors) },
    ]),
  );

  const { schemaVersion, ...gameState } = parsed;

  return {
    ...gameState,
    board: new Map(Object.entries(parsed.board)),
    corporations,
  };
}
