Feature: Founding and merger dialogs
  Once js/model/'s turn machine reaches choosingCorporationToFound,
  choosingMergerSurvivor, or a resolvingMerger step the human owns, the UI
  needs a real dialog for them to act through. Unlike steps/model-steps.js
  (which drives js/model/ directly via page.evaluate()), these scenarios
  click the actual rendered page the way a real player would.

  Background:
    Given the game is freshly loaded

  Scenario: Placing a sector next to a lone sector opens the founding dialog
    Given the board already has an unincorporated sector at "1-A"
    And "Player 1" has only sector "2-A" in hand
    When "Player 1" places sector "2-A" via the Star Map
    Then the founding dialog is open
    When "Player 1" founds "Nova Traders" via the dialog
    Then the turn status reads "Your turn — buy shares, or press End Turn."
    And "Nova Traders" shows 2 sectors in the Market

  Scenario: A tied merger walks through the survivor and share-disposition dialogs
    Given the corporation "novaTraders" already occupies sectors "1-A, 2-A, 3-A"
    And the corporation "kestrelMining" already occupies sectors "5-A, 6-A, 7-A"
    And "Player 1" already holds 1 shares of "kestrelMining"
    And "Player 1" has only sector "4-A" in hand
    When "Player 1" places sector "4-A" via the Star Map
    Then the merger survivor dialog is open
    When "Player 1" chooses "Nova Traders" to survive via the dialog
    Then the share disposition dialog is open
    When "Player 1" confirms the share disposition dialog with default values
    Then the turn status reads "Your turn — buy shares, or press End Turn."
    And "Nova Traders" shows 6 sectors in the Market
