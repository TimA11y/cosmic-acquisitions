Feature: Ending the game
  Once isEndGameAvailable() is true (some corporation has reached 41+
  sectors, or every active corporation is secure), the human can voluntarily
  end the game via the End Game button (docs/game-engine-api.md's
  endGame()) — this closes the last dead-end turn phase: previously nothing
  in js/ui/ called endGame() at all.

  Background:
    Given the game is freshly loaded

  Scenario: Ending the game once a corporation reaches 41 sectors
    Given the corporation "novaTraders" already occupies 41 sectors
    And "Player 1" already holds 5 shares of "novaTraders"
    And "Nebula AI" already holds 3 shares of "novaTraders"
    When "Player 1" ends the game via the button
    Then the game over summary is shown
    And the turn status reads "Game over — see the Event Log for final standings."
    And the final standings show "Player 1" with 22500 credits
    And the final standings show "Nebula AI" with 14800 credits
