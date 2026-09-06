Feature: Mergers
  Mergers combine two or more adjacent corporations into one; the largest
  survives automatically unless there's a tie, in which case the acting
  player chooses (docs/game-engine-api.md's "choosingMergerSurvivor" phase).
  A merger that would combine two already-secure (11+ sector) corporations
  is illegal, making the triggering tile a dead tile instead.

  Background:
    Given a new game with players "Ada" and "Grace"

  Scenario: A tied merger asks the player to choose a survivor, then pays the sole shareholder's bonus
    Given "novaTraders" occupies sectors "1-A, 2-A, 3-A"
    And "kestrelMining" occupies sectors "5-A, 6-A, 7-A"
    And "Grace" holds 1 shares of "kestrelMining"
    And "Grace"'s credits are noted
    And "Ada" is holding only sector "4-A"
    When "Ada" places sector "4-A"
    Then the turn phase is "choosingMergerSurvivor"
    When "Ada" chooses "novaTraders" to survive the merger
    Then "kestrelMining" has 0 sectors
    And "novaTraders" has 6 sectors
    When "Grace" disposes of their shares in "kestrelMining": sell 1, trade 0, hold 0
    # kestrelMining was economy tier at size 3 (300 credits/share) when the
    # merger triggered: sole shareholder gets the combined majority+minority
    # bonus (300 * 15 = 4500) plus the sale proceeds (300 * 1 = 300).
    Then "Grace"'s credits increased by 4800
    And the turn phase is "buyingShares"

  Scenario: A tile that would merge two secure corporations is dead
    Given "titanIndustries" occupies 11 contiguous sectors in row "C" starting at column 1
    And "zenithConsortium" occupies 11 contiguous sectors in row "E" starting at column 1
    And "Ada" is holding only sector "1-D"
    Then sector "1-D" is a dead tile
    When "Ada" exchanges dead sector "1-D"
    Then "Ada" does not hold sector "1-D"
