Feature: Buying shares and ending the game

  Background:
    Given a new game with players "Ada" and "Grace"

  Scenario: Buying a 4th share in one turn is rejected
    Given "novaTraders" occupies sectors "1-A, 2-A"
    And "Ada" is holding only sector "3-A"
    When "Ada" places sector "3-A"
    And "Ada" buys 3 shares of "novaTraders"
    And "Ada" attempts to buy 1 shares of "novaTraders"
    Then the attempt is rejected

  Scenario: A 41-sector corporation makes ending the game available, and ending it liquidates corporations
    Given "novaTraders" occupies 41 sectors
    And "Ada" holds 5 shares of "novaTraders"
    And "Grace" holds 3 shares of "novaTraders"
    Then ending the game is available
    When "Ada" ends the game
    Then the turn phase is "gameOver"
    And "Ada" should hold 0 shares of "novaTraders"
    And "Grace" should hold 0 shares of "novaTraders"
