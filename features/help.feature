Feature: Help
  A freely-dismissible "How to Play" reference dialog and phase-specific
  contextual hints (docs/help-design.md) — unlike every mandatory decision
  dialog elsewhere in this UI, reading help isn't something that needs to be
  intercepted.

  Background:
    Given the game is freshly loaded

  Scenario: How to Play is freely dismissible, unlike the mandatory dialogs
    When "Player 1" opens How to Play
    Then the How to Play dialog is open
    When Escape is pressed
    Then the How to Play dialog is closed

  Scenario: A contextual hint stays expanded across a phase change
    Then the contextual hint is visible
    When the contextual hint is expanded
    And the human places any available sector
    Then the contextual hint is still expanded

  Scenario: A contextual hint's "Learn more" link opens How to Play focused on the right section
    When the contextual hint is expanded
    And "Learn more" is clicked in the contextual hint
    Then the How to Play dialog is open
    And the focused element is "help-placing"
