const { test, expect, devices } = require('@playwright/test');

test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 }, userAgent: devices['iPhone 15'].userAgent, serviceWorkers: 'block' });

const profiles = [
  { name: 'iPhone', options: { ...devices['iPhone 15'] } },
  { name: 'iPad half', options: { ...devices['iPad Pro 11'], viewport: { width: 683, height: 960 } } },
  { name: 'iPad quarter', options: { ...devices['iPad Pro 11'], viewport: { width: 320, height: 960 } } }
];

async function prepare(page, count = 40) {
  await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?e2e=1');
  await expect(page.locator('#notepad-editor')).toBeVisible();
  await page.evaluate(count => {
    const html = Array.from({ length: count }, (_, i) =>
      `<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="sample-${i}" contenteditable="false">Bed ${i + 1}</span></div>` +
      Array.from({ length: 3 + i % 7 }, (_, j) => `<div>Sample bed ${i + 1}, detail ${j + 1}</div>`).join('') + '<div><br></div>'
    ).join('');
    setNoteDocumentHtml(getCurrentNote(), html);
    render();
    window.scrollTo(0, 300);
    setBedIndexVisible(true);
    const dot = document.createElement('div');
    dot.id = 'test-finger';
    Object.assign(dot.style, { position: 'fixed', width: '14px', height: '14px', border: '2px solid #db1779',
      borderRadius: '50%', zIndex: '9999', pointerEvents: 'none', transform: 'translate(-50%, -50%)' });
    document.body.appendChild(dot);
  }, count);
  await expect(page.locator('.bed-index-rail')).toHaveCSS('opacity', '1');
}

async function point(page, index) {
  return page.locator(`[data-bed-index="${index}"]`).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: el.textContent.trim() };
  });
}

// WebKit exposes trusted taps but no drag API. These touch event streams drive the
// production iOS handlers; Chromium additionally gets a native touch drag below.
async function touch(page, type, p, extra = {}) {
  return page.evaluate(async ({ type, p, extra }) => {
    const rail = document.querySelector('.bed-index-rail');
    const make = (id, x, y) => ({ identifier: id, target: rail, clientX: x, clientY: y, screenX: x, screenY: y });
    const primary = make(7, p.x, p.y);
    const secondary = make(9, p.x - 15, p.y + 10);
    const dot = document.querySelector('#test-finger');
    dot.style.left = `${p.x}px`; dot.style.top = `${p.y}px`;
    if (type === 'start') rail.dispatchEvent(new PointerEvent('pointerdown', {
      pointerType: 'touch', pointerId: 7, clientX: p.x, clientY: p.y, screenY: p.y,
      bubbles: true, cancelable: true, button: 0, isPrimary: true
    }));
    if (type === 'move') rail.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'touch', pointerId: 7, clientX: p.x, clientY: 0, screenY: p.y,
      bubbles: true, cancelable: true, button: 0, isPrimary: true
    }));
    const eventType = { start: 'touchstart', move: 'touchmove', end: 'touchend', cancel: 'touchcancel', secondaryEnd: 'touchend' }[type];
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      touches: { value: type === 'secondaryEnd' ? [primary] : ['end', 'cancel'].includes(type) ? [] : extra.second ? [secondary, primary] : [primary] },
      changedTouches: { value: type === 'secondaryEnd' ? [secondary] : [primary] }
    });
    rail.dispatchEvent(event);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const token = document.querySelector(`#notepad-editor [data-token-id="sample-${extra.expectedIndex ?? 20}"]`);
    const railRect = rail.getBoundingClientRect();
    const bubble = rail.querySelector('.bed-index-bubble').getBoundingClientRect();
    return { active: rail.dataset.activeIndex, label: rail.querySelector('.bed-index-bubble').textContent,
      scroll: window.scrollY, tokenY: token?.getBoundingClientRect().top,
      bubbleY: bubble.y + bubble.height / 2, scrubbing: rail.classList.contains('is-scrubbing'),
      railTop: railRect.top, railBottom: railRect.bottom };
  }, { type, p, extra });
}

for (const profile of profiles) {
  test.describe(profile.name, () => {
    const { defaultBrowserType, ...deviceOptions } = profile.options;
    test.use({ ...deviceOptions, serviceWorkers: 'block' });
    test.beforeEach(async ({ page }, info) => {
      test.skip(info.project.name === 'iphone-webkit', 'Explicit iPhone and iPad profiles run in both engine projects.');
      await prepare(page);
    });

    test('a real touch tap selects the printed bed under the finger', async ({ page }) => {
      const p = await point(page, 20);
      await page.touchscreen.tap(p.x, p.y);
      await expect(page.locator('.bed-index-rail')).toHaveAttribute('data-active-index', '20');
      const target = page.locator('[data-token-id="sample-20"]');
      await expect(target).toBeInViewport();
      expect(await target.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(200);
    });

    test('real taps keep the first and last beds selected after release', async ({ page }) => {
      for (const index of [39, 0]) {
        await page.evaluate(() => setBedIndexVisible(true));
        const p = await point(page, index);
        await page.touchscreen.tap(p.x, p.y);
        await expect(page.locator('.bed-index-rail')).toHaveAttribute('data-active-index', String(index));
        await expect(page.locator(`[data-token-id="sample-${index}"]`)).toBeInViewport();
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 160)));
        await expect(page.locator('.bed-index-rail')).toHaveAttribute('data-active-index', String(index));
      }
      await page.evaluate(() => window.scrollBy(0, innerHeight));
      await expect(page.locator('.bed-index-rail')).not.toHaveAttribute('data-active-index', '0');
    });

    test('drag follows finger position every rendered frame, reverses, and holds without drift', async ({ page }, info) => {
      const from = await point(page, 10);
      const to = await point(page, 29);
      const initial = await touch(page, 'start', from, { expectedIndex: 10 });
      expect(initial.label).toBe(`Bed ${from.label}`);
      const geometry = await page.evaluate(() => ({
        marks: Array.from(document.querySelectorAll('[data-bed-index]')).map(el => ({
          index: Number(el.dataset.bedIndex), y: el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2
        })),
        tops: Array.from(document.querySelectorAll('#notepad-editor [data-tag="bed"]')).map(el =>
          el.closest('div').getBoundingClientRect().top + window.scrollY),
        maxScroll: document.documentElement.scrollHeight - innerHeight
      }));
      let maxError = 0;
      let last = initial;
      for (let step = 0; step <= 36; step++) {
        const progress = step <= 18 ? step / 18 : (36 - step) / 18;
        const p = { x: from.x, y: from.y + (to.y - from.y) * progress };
        last = await touch(page, 'move', p);
        const upper = geometry.marks.findIndex(mark => mark.y >= p.y);
        const lo = geometry.marks[Math.max(0, upper - 1)];
        const hi = geometry.marks[upper];
        const position = lo.index + (hi.index - lo.index) * (p.y - lo.y) / (hi.y - lo.y);
        expect(Number(last.active)).toBe(Math.round(position));
        const lowerIndex = Math.floor(position), upperIndex = Math.ceil(position);
        const docTop = geometry.tops[lowerIndex] + (geometry.tops[upperIndex] - geometry.tops[lowerIndex]) * (position - lowerIndex);
        const wanted = Math.max(0, Math.min(geometry.maxScroll, initial.scroll + docTop - geometry.tops[10]));
        maxError = Math.max(maxError, Math.abs(last.scroll - wanted));
        expect(Math.abs(last.scroll - wanted)).toBeLessThanOrEqual(2);
        expect(Math.abs(last.bubbleY - p.y)).toBeLessThanOrEqual(1);
        if ([0, 18, 36].includes(step)) await page.screenshot({ path: info.outputPath(`finger-frame-${step}.png`), scale: 'css' });
      }
      expect(Math.abs(last.scroll - initial.scroll)).toBeLessThanOrEqual(2);
      const held = await touch(page, 'move', from);
      expect(Math.abs(held.scroll - last.scroll)).toBeLessThanOrEqual(1);
      const released = await touch(page, 'end', from);
      expect(released.scrubbing).toBe(false);
      expect(Math.abs(released.scroll - held.scroll)).toBeLessThanOrEqual(1);
      await info.attach('frame-following-error', { body: JSON.stringify({ maximumScrollErrorPixels: maxError, samples: 37 }), contentType: 'application/json' });
    });

    test('secondary finger release does not end the drag and the final touch coordinate is applied', async ({ page }) => {
      const from = await point(page, 10);
      await touch(page, 'start', from);
      await touch(page, 'move', from, { second: true });
      expect((await touch(page, 'secondaryEnd', from)).scrubbing).toBe(true);
      const to = await point(page, 29);
      const end = await touch(page, 'end', to, { expectedIndex: 29 });
      expect(end.label).toBe(`Bed ${to.label}`);
      expect(end.scrubbing).toBe(false);
      expect(end.tokenY).toBeGreaterThan(200);
      expect(end.tokenY).toBeLessThan(profile.options.viewport.height - 100);
    });

    test('viewport changes, endpoints, cancellation and another drag keep matching the labels', async ({ page }) => {
      await touch(page, 'start', await point(page, 20));
      await page.setViewportSize({ ...profile.options.viewport, height: profile.options.viewport.height - 120 });
      for (const index of [39, 0, 20]) {
        const p = await point(page, index);
        expect((await touch(page, 'move', p)).label).toBe(`Bed ${p.label}`);
      }
      expect((await touch(page, 'cancel', await point(page, 20))).scrubbing).toBe(false);
      const p = await point(page, 5);
      expect((await touch(page, 'start', p)).label).toBe(`Bed ${p.label}`);
      await touch(page, 'end', p);
    });
  });
}

test('trusted Chromium touch drags follow labels without scrolling the page independently', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native drag injection uses Chromium CDP; WebKit gets trusted taps and touch stream tests.');
  await prepare(page);
  const session = await context.newCDPSession(page);
  await page.evaluate(() => document.querySelector('.bed-index-rail').addEventListener('touchmove', event => {
    window.testTrustedIndexMove = event.isTrusted;
  }));
  let initialScroll;
  for (const index of [10, 15, 20, 24, 29, 24, 20, 15, 10]) {
    const p = await point(page, index);
    await session.send('Input.dispatchTouchEvent', { type: initialScroll === undefined ? 'touchStart' : 'touchMove',
      touchPoints: [{ x: p.x, y: p.y, id: 7, radiusX: 4, radiusY: 4, force: 1 }] });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.bed-index-rail')).toHaveAttribute('data-active-index', String(index));
    if (initialScroll === undefined) initialScroll = await page.evaluate(() => window.scrollY);
  }
  expect(await page.evaluate(() => window.testTrustedIndexMove)).toBe(true);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - initialScroll)).toBeLessThanOrEqual(2);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.bed-index-rail')).not.toHaveClass(/is-scrubbing/);
});

test('an uncompressed short index uses the same physical label mapping', async ({ page }, info) => {
  test.skip(info.project.name === 'iphone-webkit', 'Covered by explicit profiles.');
  await prepare(page, 6);
  await expect(page.locator('.bed-index-rail')).not.toHaveClass(/is-condensed/);
  for (const index of [4, 1]) {
    const p = await point(page, index);
    const sample = await touch(page, 'start', p);
    expect(sample.label).toBe(`Bed ${p.label}`);
    await touch(page, 'end', p);
  }
});
