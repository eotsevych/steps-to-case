import { test as base, expect } from '@playwright/test';
import { RoomsPage } from '@pages/RoomsPage';
import { BookPage } from '@pages/BookPage';
import { ConfirmedPage } from '@pages/ConfirmedPage';

// Add page objects here as fixtures, e.g. roomsPage: async ({ page }, use) => use(new RoomsPage(page))
type Pages = {
  roomsPage: RoomsPage;
  bookPage: BookPage;
  confirmedPage: ConfirmedPage;
};

/** Tests import `test` and `expect` from here, never from '@playwright/test'. */
export const test = base.extend<Pages>({
  roomsPage: async ({ page }, use) => use(new RoomsPage(page)),
  bookPage: async ({ page }, use) => use(new BookPage(page)),
  confirmedPage: async ({ page }, use) => use(new ConfirmedPage(page)),
});

export { expect };
