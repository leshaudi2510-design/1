// Section consent: the cookie banner and Cookie settings with a test GA4 ID.

export default [
  {
    id: 'consent',
    title: 'Consent with a test GA4 ID',
    async run(t) {
      const { browser } = t;
      const { analytics: GA } = t.roles;
      const { expect, context, watch, until, focused, lostFocus, refuseOthers, pressOn, toastText } = t.harness;

      const ctx = await context(browser);
      // Routes registered later run first: Google's stub goes after the refusal of everything else.
      await refuseOthers(ctx, GA.base);
      const google = [];
      await ctx.route(/^https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google|doubleclick|google)\.[a-z.]+\//, (route) => {
        google.push(route.request().url());
        return /gtag\/js/.test(route.request().url())
          ? route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.dataLayer = window.dataLayer || [];' })
          : route.fulfill({ status: 204, body: '' });
      });
      const page = await ctx.newPage();
      const w = watch(page, GA.base);
      await page.goto(GA.base + '/', { waitUntil: 'networkidle' });
      const shown = await until(page, () => document.querySelector('.consent-banner') && !document.querySelector('.consent-banner').hidden);
      expect(shown, 'the cookie banner shows on the first visit');
      const before = await page.evaluate(() => ({
        defaults: (window.dataLayer || []).map((a) => Array.from(a)).find((a) => a[0] === 'consent' && a[1] === 'default')?.[2],
        cookies: document.cookie,
        tag: Boolean(document.querySelector('script[src*="googletagmanager"]')),
      }));
      const d = before.defaults || {};
      const v2 = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];
      expect(v2.every((k) => d[k] === 'denied') && Object.values(d).every((v) => v === 'denied'),
        `Consent Mode v2 defaults are all "denied" (${Object.keys(d).length} signals)`, JSON.stringify(before.defaults));
      expect(!w.foreign.length && !before.tag, 'nothing from Google (or anyone else) before a choice', w.foreign.join(', '));
      expect(!before.cookies, 'no cookies before a choice', before.cookies);

      const weigh = (sel) =>
        page.$$eval(sel, (bs) => bs.map((b) => {
          const r = b.getBoundingClientRect();
          const s = getComputedStyle(b);
          return { text: b.textContent.trim(), kind: b.dataset.consent || b.dataset.open, w: Math.round(r.width), h: Math.round(r.height), look: [s.backgroundColor, s.color, s.borderTopColor, s.borderTopWidth, s.borderTopStyle, s.fontWeight, s.fontSize, s.boxShadow, s.textDecorationLine].join(' ') };
        }));
      const equal = (list) => {
        const rej = list.find((b) => b.kind === 'reject');
        const acc = list.find((b) => b.kind === 'accept');
        return rej && acc && rej.look === acc.look && rej.h === acc.h && Math.abs(rej.w - acc.w) <= 1;
      };
      const banner = await weigh('.consent-banner button');
      expect(equal(banner), '"Reject all" and "Accept all" carry equal visual weight in the banner', JSON.stringify(banner));

      await page.click('.consent-banner [data-consent="reject"]');
      await until(page, () => document.querySelector('.consent-banner').hidden && localStorage.getItem(__chk.key('consent')));
      const after = await page.evaluate(() => ({ tag: Boolean(document.querySelector('script[src*="googletagmanager"]')), stored: JSON.parse(localStorage.getItem(__chk.key('consent'))) }));
      expect(!after.tag && !google.length && !w.foreign.length && after.stored?.analytics === false, 'nothing loads after "Reject all"', JSON.stringify({ ...after, google }));

      await page.click('.colophon [data-open="consent"]');
      await until(page, () => document.getElementById('consent').open);
      const dialog = await weigh('#consent .consent__actions button');
      expect(equal(dialog), '"Reject all" and "Accept all" carry equal visual weight in Cookie settings', JSON.stringify(dialog));
      const gtag = page.waitForRequest((r) => /googletagmanager\.com\/gtag\/js\?id=G-TEST000000/.test(r.url()), { timeout: 10000 }).then(() => true, () => false);
      await page.click('#consent [data-consent="accept"]');
      expect(await gtag, 'gtag.js loads only after "Accept all"');
      const other = w.foreign.filter((u) => !/googletagmanager\.com/.test(u));
      expect(!other.length, 'no other origin contacted', other.join(', '));
      expect(!w.errors.length, 'no console or page errors', w.errors.join(' | '));
      await ctx.close();

      // The banner is fixed at the bottom but first in the Tab order, never covers a focused control,
      // and a choice made in it (or in Manage) leaves focus on the page, not on <body>.
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        const vw = viewport.width;
        const fresh = await context(browser, { viewport });
        await refuseOthers(fresh, GA.base);
        const pg = await fresh.newPage();
        await pg.goto(GA.base + '/', { waitUntil: 'networkidle' });
        await until(pg, () => !document.querySelector('.consent-banner').hidden);
        const covered = [];
        let first = null;
        for (let i = 0; i < 80; i++) {
          await pg.keyboard.press('Tab');
          const r = await pg.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return { end: true };
            const banner = document.querySelector('.consent-banner');
            if (banner.contains(el)) return { inBanner: true };
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height) return {};
            let seen = 0;
            for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
              const hit = document.elementFromPoint(b.left + ((x + 0.5) / 5) * b.width, b.top + ((y + 0.5) / 3) * b.height);
              if (hit && !banner.contains(hit)) seen++;
            }
            return seen ? {} : { covered: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
          });
          if (r.end) break;
          if (r.inBanner && first === null) first = i + 1;
          if (r.covered) covered.push(r.covered);
        }
        expect(first !== null && first <= 3 && !covered.length, `${vw}px: the cookie banner comes first in the Tab order and never covers a focused control`, JSON.stringify({ first, covered: covered.slice(0, 6) }));

        await pg.focus('.consent-banner [data-consent="reject"]');
        await pg.keyboard.press('Enter');
        await until(pg, () => document.querySelector('.consent-banner').hidden);
        const afterReject = await pg.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, toast: document.querySelector('#toast .toast__msg').textContent }));
        await until(pg, () => /Analytics are off/.test(document.querySelector('#toast .toast__msg').textContent));
        const said = await toastText(pg);
        expect(afterReject.focus === 'main' && /Saved\. Analytics are off\./.test(said), `${vw}px: "Reject all" in the banner hides it, moves focus to the content and says what was saved`, JSON.stringify({ ...afterReject, said }));

        await pg.evaluate(() => localStorage.removeItem(__chk.key('consent')));
        await pg.reload({ waitUntil: 'networkidle' });
        await until(pg, () => !document.querySelector('.consent-banner').hidden);
        await pressOn(pg, '.consent-banner [data-open="consent"]');
        await until(pg, () => document.getElementById('consent').open);
        await pressOn(pg, '#consent [data-consent="save"]');
        await until(pg, () => !document.getElementById('consent').open && document.querySelector('.consent-banner').hidden);
        await until(pg, () => document.activeElement?.id === 'main', undefined, 2000);
        const afterSave = await pg.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
        const lost = await lostFocus(pg);
        expect(afterSave === 'main' && !lost.length, `${vw}px: "Save choices" in Manage (opened from the banner) moves focus to the content, not <body>`, JSON.stringify({ afterSave, lost }));
        await fresh.close();
      }
    },
  },
];
