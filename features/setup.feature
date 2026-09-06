Feature: Game setup
  docs/ai-design.md confirms 2-6 total players (1 human, rest AI configurable
  independently) as a real design decision. The setup dialog shown on load
  lets the player configure this before js/model/'s createGame() ever runs.

  Scenario: Changing the player count updates the number of AI rows, and starting creates that many named players
    Given the setup dialog is open
    When the player count is set to 3
    Then 2 AI opponent rows are shown
    When the human name is set to "Ada"
    And AI opponent 1 is named "Vega"
    And AI opponent 2 is named "Orion"
    And the game is started from the setup dialog
    Then the game has 3 players named "Ada", "Vega", "Orion"
