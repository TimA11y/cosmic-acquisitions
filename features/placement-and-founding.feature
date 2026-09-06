Feature: Placing sectors and founding corporations
  Placing a sector on the Star Map is the first action of every turn (see
  docs/game-engine-api.md's turn state machine). These scenarios cover the
  three simplest outcomes: staying unincorporated, founding a new
  corporation, and growing an existing one.

  Background:
    Given a new game with players "Ada" and "Grace"

  Scenario: An isolated placement stays unincorporated
    Given "Ada" is holding only sector "1-A"
    When "Ada" places sector "1-A"
    Then sector "1-A" is unincorporated
    And the turn phase is "buyingShares"

  Scenario: Placing a sector next to a lone sector founds a corporation
    Given sector "1-A" is placed and unincorporated
    And "Ada" is holding only sector "2-A"
    When "Ada" places sector "2-A"
    Then the turn phase is "choosingCorporationToFound"
    When "Ada" founds "novaTraders"
    Then "novaTraders" has 2 sectors
    And "Ada" should hold 1 shares of "novaTraders"

  Scenario: Placing a sector next to an existing corporation grows it
    Given "novaTraders" occupies sectors "1-A, 2-A"
    And "Ada" is holding only sector "3-A"
    When "Ada" places sector "3-A"
    Then "novaTraders" has 3 sectors
    And the turn phase is "buyingShares"
