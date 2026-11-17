import { test, type Page } from '@playwright/test';
import { TopBar } from '@components/TopBar';

/** Every page: its own path, the shared top bar, and open(). */
export abstract class BasePage {
  /** Path relative to baseURL, e.g. 'rooms.html'. */
  protected abstract readonly path: string;
  readonly topBar: TopBar;

  constructor(protected readonly page: Page) {
    this.topBar = new TopBar(page);
  }

  /** Opens the page; `query` is appended as is, e.g. '?room=atlas'. */
  async open(query = ''): Promise<this> {
    await test.step(`Open ${this.constructor.name}`, async () => {
      await this.page.goto(this.path + query);
    });
    return this;
  }
}
