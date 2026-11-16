import { test, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';

export class BookPage extends BasePage {
  protected readonly path = 'book.html';
  readonly titleInput: Locator;
  readonly invitePeopleInput: Locator;
  readonly videoCallCheckbox: Locator;
  readonly confirmBookingButton: Locator;

  constructor(page: Page) {
    super(page);
    this.titleInput = page.getByLabel('Meeting title');
    this.invitePeopleInput = page.getByLabel('Invite people');
    this.videoCallCheckbox = page.getByLabel('Add a video call link');
    this.confirmBookingButton = page.getByRole('button', { name: 'Confirm booking' });
  }

  slotRadio(slot: string): Locator {
    // exact: '09:00' is a substring of '09:00 (booked)'
    return this.page.getByRole('radio', { name: slot, exact: true });
  }

  async fillMeetingTitle(title: string): Promise<void> {
    await test.step(`Fill Meeting title with ${title}`, async () => {
      await this.titleInput.fill(title);
    });
  }

  async selectTimeFor(slot: string): Promise<void> {
    await test.step(`Select time for ${slot}`, async () => {
      await this.slotRadio(slot).check();
    });
  }

  async fillInvitePeople(email: string): Promise<void> {
    await test.step(`Fill Invite people with ${email}`, async () => {
      await this.invitePeopleInput.fill(email);
    });
  }

  async checkAddAVideoCallLink(): Promise<void> {
    await test.step('Check Add a video call link', async () => {
      await this.videoCallCheckbox.check();
    });
  }

  async clickOnConfirmBooking(): Promise<void> {
    await test.step('Click on Confirm booking', async () => {
      await this.confirmBookingButton.click();
    });
  }
}
