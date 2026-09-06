Feature: Save and resume
  A single localStorage save, auto-saved after every end-of-turn drawTile()
  call (docs/persistence-design.md), survives a real page reload.

  Background:
    Given the game is freshly loaded

  Scenario: Ending a turn persists a save that survives a reload
    When the human places any sector and ends their turn
    And the page is reloaded
    Then the resume dialog is open
    When "Player 1" resumes the saved game
    Then the turn number is at least 2

  Scenario: Starting a new game from the resume dialog clears the save
    When the human places any sector and ends their turn
    And the page is reloaded
    Then the resume dialog is open
    When a new game is started from the resume dialog
    Then the setup dialog is visible
    When the page is reloaded
    Then the setup dialog is visible

  Scenario: The mid-play New Game button requires confirmation before discarding progress
    When "Player 1" opens the New Game confirmation
    And cancels the New Game confirmation
    Then the game is still in progress
    When "Player 1" opens the New Game confirmation
    And confirms starting a new game
    Then the setup dialog is visible
