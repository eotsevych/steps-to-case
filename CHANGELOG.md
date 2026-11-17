# Changelog · Історія змін

## 1.1.0 — November 2026 · листопад 2026

### English

#### New

- **Saved values.** The new **Capture** button keeps the text of an element (a booking ID, a date) under a name. Click **Capture**, then the element: the step is named after the text next to the element, and you can pick another text or type your own. An assertion can then expect that value, or a value you typed earlier, instead of a copied text. In the export the step has `saveAs` and the assertion has `valueFrom`, so the generated test reads the value into a variable.
- **Which container of several.** When you name a container (*Product card*), tick under **Identify this one by** what tells it from the similar ones, for example the product name. The panel says if other containers have the same value. The export keeps your choice in `containerIdentity`, and the generated test gets it as a parameter: `buyProduct("Item 1")`.
- **The action is a field.** Every recorded step has `actionType` (`click`, `dblclick`, `fill`, ...). A double-click renamed to "Open the order" stays a double-click.
- **More context in the export**, so generated tests need less guessing:
  - `pageDomain` on each page: the site the page is on, for tests that cross sites.
  - `pageQuery` on each step, and the query string in `startUrl`: pages like `tryit.asp?filename=…` can be opened again. Secret-looking values (tokens, codes, keys) are masked.
  - `tab` on each step: the browser tab it ran in, when the recording opened new tabs.
  - `frameId` and `frameName` on steps inside an iframe: the iframe can be found even when it has no URL of its own.

#### Changed

- **A container for a recorded step also gets a name.** The cube icon on a step used to take the name from the page. It now opens the same dialog as **+ Container**.
- **Store name:** "StepsToCase: QA Test Recorder & Test Case Generator". The extension no longer asks for the `activeTab` permission.

#### Fixed

- **A password stays masked after "show password".** A field that was a password field is masked in the step, in its attributes and in the container HTML, also after the page turns it into a text field. This also works when you show the password before you start the recording, when the field is inside a shadow root, and when the page puts a new text field in place of the password field. A text field is masked too when its name, id, placeholder or label says it is a password, or when a "Hide password" button stands next to it.
- **Typing right before a click.** Text typed less than half a second before a click was recorded after the click, or lost when the click opened another page. It is now recorded first. The requests of a click that opens another page (a login) are kept too.
- **Elements inside a shadow root.** Picking a container for such a step highlighted a look-alike element in the main page, and the label of a field could come from another element with the same id.
- **Step names of icon buttons.** A button without text was named after its CSS selector (`Click on "#_R_2pt4b36_"`). It now gets its own accessible name (`Click on "Open Copilot menu"`).
- **Steps inside iframes** lost their `frameUrl` after the browser restarted the extension's background worker during a recording.
- **After a browser restart** an unfinished recording is paused, and **Continue** picks the tab again. Before, it could record another tab.
- **A recording that is too large to save**, or a JSON file that cannot be loaded, now shows a message in the panel.
- **A page change long after a step** is no longer attached to that step as its result.
- **Pages you made by hand** without a URL were merged into one page in the export.

Thanks to [stokrattt](https://github.com/stokrattt) for the password masking and typing-before-click fixes ([#3](https://github.com/eotsevych/steps-to-case/pull/3), [#4](https://github.com/eotsevych/steps-to-case/pull/4)).

### Українська

#### Нове

- **Збережені значення.** Нова кнопка **Capture** зберігає текст елемента (номер бронювання, дату) під назвою. Натисніть **Capture**, потім елемент: крок отримує назву з тексту поруч з елементом; можна обрати інший текст або ввести свій. Перевірка може очікувати це значення або значення, яке ви ввели раніше, замість скопійованого тексту. В експорті крок має `saveAs`, а перевірка має `valueFrom`, тож згенерований тест читає значення у змінну.
- **Який саме контейнер із кількох.** Коли ви називаєте контейнер (*Product card*), позначте під **Identify this one by** те, що відрізняє його від схожих, наприклад назву товару. Панель повідомляє, якщо інші контейнери мають таке саме значення. Експорт зберігає ваш вибір у `containerIdentity`, а згенерований тест отримує його як параметр: `buyProduct("Item 1")`.
- **Дія тепер є полем.** Кожен записаний крок має `actionType` (`click`, `dblclick`, `fill`, ...). Подвійний клік, перейменований на "Open the order", залишається подвійним кліком.
- **Більше контексту в експорті**, щоб згенерованим тестам доводилося менше вгадувати:
  - `pageDomain` для кожної сторінки: сайт, на якому вона відкрита, для тестів, що переходять між сайтами.
  - `pageQuery` для кожного кроку та рядок запиту в `startUrl`: сторінки на кшталт `tryit.asp?filename=…` можна відкрити знову. Значення, схожі на секрети (токени, коди, ключі), замасковано.
  - `tab` для кожного кроку: вкладка браузера, у якій він виконаний, якщо запис відкривав нові вкладки.
  - `frameId` і `frameName` для кроків усередині iframe: iframe можна знайти, навіть якщо в нього немає власної URL-адреси.

#### Змінено

- **Контейнер для записаного кроку теж отримує назву.** Іконка куба на кроці раніше брала назву зі сторінки. Тепер вона відкриває той самий діалог, що й **+ Container**.
- **Назва в магазині:** "StepsToCase: QA Test Recorder & Test Case Generator". Розширення більше не просить дозвіл `activeTab`.

#### Виправлено

- **Пароль залишається замаскованим після "показати пароль".** Поле, яке було полем пароля, маскується в кроці, в його атрибутах і в HTML контейнера, навіть коли сторінка перетворює його на текстове. Це працює і тоді, коли ви показали пароль до початку запису, коли поле розміщене всередині shadow root, і коли сторінка ставить нове текстове поле на місце поля пароля. Текстове поле маскується також, якщо його назва, id, підказка або підпис вказує на пароль, або якщо поруч є кнопка "Hide password".
- **Введення тексту перед кліком.** Текст, введений менш ніж за пів секунди до кліку, записувався після кліку або губився, якщо клік відкривав іншу сторінку. Тепер він записується першим. Запити кліку, який відкриває іншу сторінку (вхід у систему), теж зберігаються.
- **Елементи всередині shadow root.** Вибір контейнера для такого кроку підсвічував схожий елемент на основній сторінці, а назва поля могла братися з іншого елемента з таким самим id.
- **Назви кроків для кнопок-іконок.** Кнопка без тексту отримувала назву за CSS-селектором (`Click on "#_R_2pt4b36_"`). Тепер вона отримує власну доступну назву (`Click on "Open Copilot menu"`).
- **Кроки всередині iframe** втрачали `frameUrl`, якщо браузер перезапускав фоновий процес розширення під час запису.
- **Після перезапуску браузера** незавершений запис ставиться на паузу, а **Continue** знову обирає вкладку. Раніше він міг записувати іншу вкладку.
- **Запис, завеликий для збереження,** або JSON-файл, який не вдається завантажити, тепер показує повідомлення в панелі.
- **Перехід на іншу сторінку через довгий час після кроку** більше не прив'язується до цього кроку як його результат.
- **Сторінки, створені вручну** без URL, об'єднувалися в одну сторінку в експорті.

Дякуємо [stokrattt](https://github.com/stokrattt) за виправлення маскування пароля та введення тексту перед кліком ([#3](https://github.com/eotsevych/steps-to-case/pull/3), [#4](https://github.com/eotsevych/steps-to-case/pull/4)).

## Test generator skill — November 2026 · листопад 2026

No change to the extension: version 1.0.2 works with it.

Без змін у розширенні: працює з версією 1.0.2.

### English

- **Test generator for your framework.** The [`stepstocase-setup`](skills/stepstocase-setup) agent skill scans your test repository and writes a `/generate-autotest` command that turns recordings into tests your team's way. It works with Claude Code, Cursor, GitHub Copilot, Codex and other agents. Install it with `npx skills add eotsevych/steps-to-case --skill stepstocase-setup`.
- **Documentation:** section 6 explains how to install and run it.

### Українська

- **Генератор тестів для вашого фреймворку.** Скіл для AI-агентів [`stepstocase-setup`](skills/stepstocase-setup) сканує репозиторій з тестами й створює команду `/generate-autotest`, яка перетворює записи на тести так, як їх пише ваша команда. Працює з Claude Code, Cursor, GitHub Copilot, Codex та іншими агентами. Встановлення: `npx skills add eotsevych/steps-to-case --skill stepstocase-setup`.
- **Документація:** розділ 6 пояснює, як його встановити й запустити.

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
