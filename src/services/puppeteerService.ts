import { lookup } from 'node:dns/promises';
import { addExtra } from 'puppeteer-extra';
import vanillaPuppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CaptchaService } from './captchaService.js';

// Use stealth plugin to evade detection
const puppeteer = addExtra(vanillaPuppeteer as any);
puppeteer.use(StealthPlugin());

export interface PuppeteerCheckResult {
  capturedResponse: any | null;
  error?: string;
}

/**
 * Service to handle Puppeteer lifecycle and network interception for Binance.
 */
export async function executeBinancePuppeteerCheck(callingCode: string, mobile: string, captchaKey?: string): Promise<PuppeteerCheckResult> {
  // --- DNS DIAGNOSTIC ---
  try {
    const dnsResult = await lookup('accounts.binance.com');
    console.log(`[DEBUG] System DNS resolved accounts.binance.com to: ${dnsResult.address}`);
  } catch (dnsErr: any) {
    console.log(`[DEBUG] System DNS failed to resolve Binance: ${dnsErr.message}. This suggests your VPN is not covering DNS correctly.`);
  }

  const browser = await (puppeteer as any).launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--disable-dns-prefetch',
      '--ignore-certificate-errors',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const mirrors = [
    "https://accounts.binance.com/en/register",
    "https://www.binance.com/en/register",
    "https://accounts.binance.com/register",
    "https://www.binance.com/register",
    "https://www.binance.me/en/register",
    "https://www.binance.info/en/register"
  ];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Pipe browser console logs to Node console
    page.on('console', (msg: any) => {
      const text = msg.text();
      // Only log important stuff to avoid flooding
      if (text.includes('CAPTCHA') || text.includes('IDGM') || text.includes('LAYOUT') || text.includes('ERROR')) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    let capturedResponse: any = null;
    let validateId: string | null = null;

    // --- NETWORK SPY ---
    page.on('request', (request: any) => {
      const url = request.url();
      if (url.includes('/bapi/')) {
        console.log(`[NETWORK SPY] >> ${request.method()} ${url}`);
      }
    });

    page.on('response', async (response: any) => {
      const url = response.url();
      if (url.includes('/bapi/')) {
        const status = response.status();
        try {
          const body = await response.json();
          console.log(`[NETWORK SPY] << ${status} ${url} | Body: ${JSON.stringify(body).slice(0, 250)}...`);
          
          // CAPTURE ALL BAPI RESPONSES AS POTENTIAL RESULTS
          // If we get a code other than 000000, it's likely a registration hint
          if (body.code && body.code !== "000000") {
             console.log(`[SIGNATURE DETECTED] ${body.code}: ${body.message}`);
             capturedResponse = body; 
          }

          if (url.includes("/bapi/accounts/v1/public/account/security/request/precheck")) {
            if (body.data && body.data.validateId) {
              validateId = body.data.validateId;
            }
          }
          if (url.includes("/bapi/accounts/v1/public/account/mobile/sendMobileVerifyCode")) {
            capturedResponse = body;
          }
        } catch (e) {}
      }
    });

    // Navigate with a fast fallback loop
    let navigated = false;
    for (const mirror of mirrors) {
      if (navigated) break;
      console.log(`Trying registration mirror: ${mirror}...`);
      try {
        const response = await page.goto(mirror, {
          waitUntil: ['load', 'networkidle2'],
          timeout: 45000 
        });
        const status = response?.status();
        const content = await page.content();
        if (status === 404 || status === 403 || content.includes("Blocked")) {
          continue;
        }
        navigated = true;
        console.log(`[SUCCESS] Landed on ${mirror}`);
      } catch (e: any) {
        console.log(`[DEBUG] Mirror ${mirror} failed: ${e.message}`);
      }
    }

    if (!navigated) {
      await browser.close();
      return { capturedResponse: null, error: "CRITICAL: All mirrors failed." };
    }

    // --- VISUAL DIAGNOSTICS ---
    console.log("Waiting for page hydration (30s)...");
    await new Promise(r => setTimeout(r, 30000));
    
    console.log("[DEBUG] Photo 1: Initial state...");
    await page.screenshot({ path: '01_landed.png' });
    // --- INTERACTION ---
    const isSingleField = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="without country code" i]');
      return !!input;
    });

    // ROBUST CHECKBOX CLOCKING
    console.log("[DEBUG] Hijacking privacy checkbox...");
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label, span, div'));
      const privacyLabel = labels.find(l => l.textContent?.includes('agree to Binance') || l.textContent?.includes('Privacy Notice'));
      if (privacyLabel) {
        console.log(`[BROWSER] Clicking found privacy label: ${privacyLabel.textContent?.slice(0,20)}`);
        (privacyLabel as HTMLElement).click();
      } else {
        const checkbox = document.querySelector('input[type="checkbox"]') as HTMLElement;
        if (checkbox) checkbox.click();
      }

      // Clear other overlays
      const overlays = Array.from(document.querySelectorAll('button, a')).filter(el => {
        const t = el.textContent?.toLowerCase() || '';
        return (t.includes('accept') || t.includes('agree') || t.includes('ok')) && !t.includes('continue');
      });
      overlays.forEach(o => (o as HTMLElement).click());
    });
    await new Promise(r => setTimeout(r, 2000));

    // ... Rest of the logic ...
    // (Ensure we use the new response capture logic in the final wait)

    if (!isSingleField) {
      console.log(`Attempting legacy country selection: +${callingCode}`);
      try {
        const sel = '.bn-input-prefix, [class*="prefix" i]';
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.click(sel);
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.type(callingCode);
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Enter');
      } catch (e) {}
    }

    const fullNumber = isSingleField ? `+${callingCode}${mobile}` : mobile;
    const inputSelector = 'input[type="tel"], input[name="mobile"], input[placeholder*="phone" i], input[placeholder*="mobile" i], [class*="input" i] input';
    
    try {
      await page.waitForSelector(inputSelector, { timeout: 15000 });
      await page.focus(inputSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');

      console.log(`Typing: ${fullNumber}`);
      for (const char of fullNumber) {
        await page.keyboard.sendCharacter(char);
        await new Promise(r => setTimeout(r, 80 + Math.random() * 100));
      }

      console.log("[DEBUG] Photo 2: After typing...");
      await page.screenshot({ path: '02_typed.png' });

      console.log("[DEBUG] Clicking 'Continue'...");
      const buttonClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => {
          const t = b.textContent?.toLowerCase() || '';
          return (t.includes('next') || t.includes('create') || t.includes('continue')) && !b.disabled;
        });
        if (target) { (target as HTMLElement).click(); return true; }
        return false;
      });

      if (!buttonClicked) await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      
      console.log("[DEBUG] Photo 3: After clicking...");
      await page.screenshot({ path: '03_clicked.png' });

      // RESPONSE LOGGING
      console.log("Waiting for final response (60s)...");
      const startTime = Date.now();
      while (!capturedResponse && Date.now() - startTime < 60000) {
        await new Promise(r => setTimeout(r, 5000));
        console.log(`[MONITOR] Still waiting... (${Math.round((Date.now() - startTime)/1000)}s)`);
        
        const pageError = await page.evaluate(() => {
          const el = document.querySelector('.bn-feedback-error, [class*="error" i], .error-message');
          return el ? el.textContent?.trim() : null;
        });
        if (pageError) {
          console.log(`[DEBUG] Page Displayed Error: ${pageError}`);
          break;
        }
      }
      
      console.log("[DEBUG] Photo 4: Final state...");
      await page.screenshot({ path: '04_final.png' });

    } catch (uiError: any) {
      console.log(`[DEBUG] UI Interaction Failure: ${uiError.message}`);
      await page.screenshot({ path: 'error_state.png' });
    }

    await browser.close();
    return { capturedResponse };

  } catch (error: any) {
    if (browser) await browser.close();
    return { capturedResponse: null, error: error.message };
  }
}
