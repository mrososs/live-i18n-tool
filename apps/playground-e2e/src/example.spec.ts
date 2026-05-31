import { test, expect } from '@playwright/test';

test('renders the localized hero title', async ({ page }) => {
  await page.goto('/');

  // The playground loads in English (app.config sets lang: 'en'); the hero
  // <h1> is bound to the `hero.title` translation key.
  await expect(page.locator('h1.hero__title')).toContainText(
    'Translate your app',
  );
});
