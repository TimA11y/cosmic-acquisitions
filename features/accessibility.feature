Feature: Accessibility
  R9 requires automated accessibility testing via @axe-core/playwright, run
  inside the same Playwright/BDD browser sessions as everything else. This is
  the first real scenario to exercise it, now that a page (index.html) exists
  to scan — earlier passes installed the dependency without a page to point
  it at yet.

  Scenario: The initial Star Map page has no automatic accessibility violations
    When I load the Star Map page
    Then it has no automatic accessibility violations
