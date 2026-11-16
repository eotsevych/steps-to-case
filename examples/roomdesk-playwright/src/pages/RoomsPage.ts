import { test, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';
import type { Day, Office, People } from '@data/rooms';

export class RoomsPage extends BasePage {
  protected readonly path = 'rooms.html';
  readonly officeSelect: Locator;
  readonly daySelect: Locator;
  readonly peopleSelect: Locator;
  readonly searchButton: Locator;

  constructor(page: Page) {
    super(page);
    this.officeSelect = page.getByLabel('Office');
    this.daySelect = page.getByLabel('Day');
    this.peopleSelect = page.getByLabel('People');
    this.searchButton = page.getByTestId('search-rooms');
  }

  roomCard(name: string): Locator {
    return this.page.getByRole('listitem').filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  async selectOffice(office: Office): Promise<void> {
    await test.step(`Select ${office} from Office`, async () => {
      await this.officeSelect.selectOption(office);
    });
  }

  async selectDay(day: Day): Promise<void> {
    await test.step(`Select ${day} from Day`, async () => {
      await this.daySelect.selectOption(day);
    });
  }

  async selectPeople(people: People): Promise<void> {
    await test.step(`Select ${people} from People`, async () => {
      await this.peopleSelect.selectOption(people);
    });
  }

  async clickOnSearch(): Promise<void> {
    await test.step('Click on Search', async () => {
      const response = this.page.waitForResponse((r) => r.url().includes('api/rooms.json'));
      await this.searchButton.click();
      await response;
    });
  }

  async clickOnBook(room: string): Promise<void> {
    await test.step('Click on Book', async () => {
      // exact: 'Book' is a substring of "My bookings" in the top bar
      await this.roomCard(room).getByRole('link', { name: 'Book', exact: true }).click();
    });
  }
}
