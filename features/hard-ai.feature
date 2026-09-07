Feature: Hard-tier AI (determinized MCTS)
  js/ai/hard.js searches the placement decision instead of guessing randomly
  or scoring heuristically (docs/ai-design.md). Reuses the same fixture
  pattern as the medium-tier tests (a deterministic hand where one option is
  obviously better) since the value difference is baked into the move's
  immediate, deterministic effect — this stays reliable even though MCTS's
  own lookahead is randomized.

  Background:
    Given the game is freshly loaded with a hard AI opponent

  Scenario: A hard AI grows a corporation it holds shares in rather than placing an isolated sector
    Given the hard AI holds 5 shares of a corporation it could grow, with an isolated alternative in hand
    When the human ends their turn
    Then the AI grew "novaTraders" instead of placing the isolated sector

  Scenario: A hard AI's decision completes within a bounded time
    Given the hard AI holds 5 shares of a corporation it could grow, with an isolated alternative in hand
    When the human ends their turn and the AI's turn is timed
    Then the AI's turn completed in under 5 seconds
