Feature: Medium-tier AI heuristics
  js/ai/medium.js scores legal moves instead of picking uniformly at random
  like easy (docs/ai-design.md). These scenarios seed a deterministic
  fixture where one option is clearly better than another and confirm the
  AI actually takes it, rather than unit-testing the scoring function
  directly (which isn't exposed through any test harness).

  Background:
    Given the game is freshly loaded with a medium AI opponent

  Scenario: A medium AI grows a corporation it holds shares in rather than placing an isolated sector
    Given the medium AI holds 3 shares of a corporation it could grow, with an isolated alternative in hand
    When the human ends their turn
    Then the AI grew "novaTraders" instead of placing the isolated sector

  Scenario: A medium AI buys into a corporation it already holds shares in
    Given the medium AI already holds shares alongside two founded corporations
    When the human ends their turn
    Then the AI's shares in "novaTraders" increased
    And the AI's shares in "kestrelMining" did not increase
