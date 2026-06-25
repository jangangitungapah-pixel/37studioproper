const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  process.stdout.write('browser-launched\\n');
  const results = {};

  async function inspect(name, viewport, screenshotPath, exercise) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const messages = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) messages.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error) => messages.push({ type: 'pageerror', text: error.message }));

    await page.goto('http://127.0.0.1:5173/admin/schedule?schedulePreview=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('.schedule-page', { timeout: 20000 });

    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
      };
      const agenda = document.querySelector('.schedule-mobile-agenda');
      return {
        url: location.href,
        title: document.title,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        toolbar: rect('.schedule-toolbar'),
        upcoming: rect('.schedule-upcoming-panel'),
        agenda: rect('.schedule-mobile-agenda'),
        grid: rect('.schedule-grid-shell'),
        agendaStartsInViewport: agenda ? agenda.getBoundingClientRect().top < window.innerHeight : false,
        visibleUpcomingRows: [...document.querySelectorAll('.schedule-upcoming-item')].filter((element) => getComputedStyle(element).display !== 'none').length,
        availableSlotButtons: document.querySelectorAll('.schedule-mobile-slot-grid button').length,
        visibleBookingRows: document.querySelectorAll('.schedule-mobile-booking').length,
        fontFamily: getComputedStyle(document.querySelector('.schedule-page')).fontFamily,
      };
    });

    const interaction = {};
    if (exercise) {
      const dpFilter = page.locator('.schedule-status-filter.is-dp');
      interaction.dpBefore = await dpFilter.getAttribute('aria-pressed');
      await dpFilter.click();
      interaction.dpAfter = await dpFilter.getAttribute('aria-pressed');
      interaction.bookingRowsAfterFilter = await page.locator('.schedule-mobile-booking').count();

      const slotButton = page.locator('.schedule-mobile-slot-grid button').first();
      await slotButton.click();
      interaction.bookingModalVisible = await page.locator('.booking-modal-panel').isVisible();
      await page.locator('.booking-modal-close').click();
    }

    await page.screenshot({ path: screenshotPath, fullPage: false });
    results[name] = { metrics, interaction, console: messages };
    await context.close();
  }

  await inspect('mobile', { width: 390, height: 844 }, 'C:/Users/hazel/source/repos/37studioproper/.schedule-mobile-after.png', true);
  await inspect('desktop', { width: 1440, height: 900 }, 'C:/Users/hazel/source/repos/37studioproper/.schedule-desktop-after.png', false);

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});