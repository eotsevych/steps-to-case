import { test, expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';

export class ConfirmedPage extends BasePage {
  protected readonly path = 'confirmed.html';
  readonly summary: Locator;

  constructor(page: Page) {
    super(page);
    this.summary = page.getByTestId('booking-summary');
  }

  async assertBookingIsConfirmedWithAMessageDetails(expected: string): Promise<void> {
    await test.step('Assert: Booking is confirmed with a message details', async () => {
      await expect(this.summary).toContainText(expected);
    });
  }
}
