# Changelog · Історія змін

## 1.0.2 — November 2026 · листопад 2026

First public version in the [Chrome Web Store](https://chromewebstore.google.com/detail/stepstocase/eekhjmlfbikagoennaldhdbliogklfec).
Перша публічна версія в [Chrome Web Store](https://chromewebstore.google.com/detail/stepstocase/eekhjmlfbikagoennaldhdbliogklfec).

### English

#### New

- **Recording inside iframes.** Actions inside frames are now recorded. These steps have a `frameUrl` field in the export.
- **`baseUrl` in the export.** The JSON has the site address as a separate field; `startUrl` and `pageUrl` are paths on it. The test case starts with the full address.
- **Hash-routed apps.** Pages like `/#/settings` (Angular, Vue) are recognized as separate pages.
- **Clearer page names.** IDs in the path (`/orders/123`, UUIDs) are left out of the page name: `/orders/123` → `orders`.
- **Recording import.** You can load a JSON file in either the internal format or the export format.

#### Fixed

- **Container picking** (before and after a step is recorded) showed "Open … in the recorded tab first" even when the right page was already open. The element is now picked in the tab that shows that step's page.
- **Containers for repeated elements**: the right row or card is found more reliably by the element's text.
- **Re-picking the element of an assertion** now saves the new element in the export.
- **Step API requests.** Only API calls (fetch / XHR) to the site's own backend are recorded, including subdomains like `api.example.com`. Scripts, images and fonts are no longer listed.
- **Passwords.** Password values are masked in the test case and in the container HTML.
- **Field names.** Text typed into a field is no longer used as the element's name; the name comes from its `<label>`.
- **Performance.** Selector generation and element description are faster on large pages and long tables.
- **Settings.** An invalid CSS selector in page or component rules is not saved. If settings can't be saved, an error is shown.

#### Removed

- Nested sub-steps. The feature was turned off, so its code was removed.

### Українська

#### Нове

- **Запис в iframe.** Дії всередині фреймів тепер записуються. Для таких кроків в експорті є поле `frameUrl`.
- **`baseUrl` в експорті.** JSON містить адресу сайту окремо, а `startUrl` і `pageUrl` — це шляхи на ньому. Тест-кейс починається з повної адреси.
- **Застосунки з hash-маршрутизацією.** Сторінки на кшталт `/#/settings` (Angular, Vue) розпізнаються як окремі сторінки.
- **Зрозуміліші назви сторінок.** ID у шляху (`/orders/123`, UUID) не потрапляють у назву сторінки: `/orders/123` → `orders`.
- **Імпорт записів.** Можна завантажити JSON як у внутрішньому форматі, так і у форматі експорту.

#### Виправлено

- **Вибір контейнера** (до та після запису кроку) показував «Open … in the recorded tab first», навіть коли потрібна сторінка вже була відкрита. Тепер елемент вибирається у вкладці, де відкрита сторінка цього кроку.
- **Вибір контейнера для повторюваних елементів** точніше знаходить потрібний рядок чи картку за текстом елемента.
- **Повторний вибір елемента для перевірки (assertion)** тепер зберігає новий елемент в експорті.
- **API-запити кроку.** Записуються лише виклики API (fetch / XHR) до бекенду сайту, включно з піддоменами на кшталт `api.example.com`. Скрипти, картинки й шрифти більше не потрапляють у список.
- **Паролі.** Значення поля пароля маскується і в тест-кейсі, і в HTML контейнера.
- **Назви полів.** Текст, введений у поле, більше не використовується як назва елемента; назва береться з `<label>`.
- **Швидкодія.** Генерація селекторів і збір опису елемента працюють швидше на великих сторінках і довгих таблицях.
- **Налаштування.** Некоректний CSS-селектор у правилах сторінок і компонентів не зберігається. Якщо налаштування не вдалося зберегти, показується помилка.

#### Видалено

- Вкладені підкроки (sub-steps). Функція була вимкнена, тож її код прибрано.
