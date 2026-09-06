Feature: Save/resume serialization
  js/model/persistence.js converts gameState to/from a JSON string for
  localStorage (docs/persistence-design.md). Board (a Map) and each
  corporation's sectors (a Set) need explicit conversion; a schemaVersion
  stamp lets a future gameState shape change detect and reject an
  incompatible old save instead of silently producing broken state.

  Background:
    Given a new game with players "Ada" and "Grace"

  Scenario: A round-trip through serialize/deserialize preserves board and corporation state
    Given "novaTraders" occupies sectors "1-A, 2-A, 3-A"
    When the game is serialized and deserialized
    Then the board is a real Map after deserializing
    And "novaTraders" has 3 sectors
    And sector "2-A" belongs to "novaTraders"

  Scenario: A save with a mismatched schema version fails to load
    Given a save with schema version 999
    Then deserializing it throws an error
