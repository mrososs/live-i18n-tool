import { test, expect } from '@playwright/test';

// The inspector auto-tags translated elements with `data-i18n-key` on startup
// (dev-only). This exercises all three Transloco integration paths the adapter
// supports, each tagged through a different mechanism:
//   - pipe (`| transloco`)            → invisible key marker on the text node
//   - attribute directive (`[transloco]`) → data-i18n-key stamped in ngOnInit
//   - structural directive (`t('…')`) → reverse-lookup of rendered text
test.describe('inspector auto-tagging across Transloco syntaxes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Auto-tagging coalesces to an animation frame after translations load.
    await expect(page.locator('h1.hero__title')).toContainText(
      'Translate your app',
    );
  });

  test('tags pipe-rendered elements', async ({ page }) => {
    await expect(page.locator('h1.hero__title')).toHaveAttribute(
      'data-i18n-key',
      'hero.title',
    );
  });

  test('tags attribute-directive elements', async ({ page }) => {
    await expect(page.locator('p.footer__rights')).toHaveAttribute(
      'data-i18n-key',
      'footer.rights',
    );
  });

  test('tags structural-directive (t() function) elements via reverse-lookup', async ({
    page,
  }) => {
    const question = page
      .locator('#faq .faq__item h3')
      .filter({ hasText: 'Does it work without a build step?' });
    await expect(question).toHaveAttribute('data-i18n-key', 'faq.q1.q');
  });
});
