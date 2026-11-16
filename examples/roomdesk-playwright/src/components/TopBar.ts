import { test, type Locator, type Page } from '@playwright/test';

/** Header shared by every page. */
export class TopBar {
  readonly root: Locator;
  readonly brand: Locator;
  readonly roomsLink: Locator;
  readonly myBookingsLink: Locator;
  readonly signedInUser: Locator;

  constructor(page: Page) {
    this.root = page.locator('header.topbar');
    this.brand = this.root.getByRole('link', { name: 'RoomDesk' });
    const nav = this.root.getByRole('navigation', { name: 'Main' });
    this.roomsLink = nav.getByRole('link', { name: 'Rooms' });
    this.myBookingsLink = nav.getByRole('link', { name: 'My bookings' });
    this.signedInUser = this.root.getByText(/^Signed in as /);
  }

  async goToRooms(): Promise<void> {
    await test.step('Go to Rooms', async () => {
      await this.roomsLink.click();
    });
  }
}
