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
      '--disable-blink-features=AutomationControlled'
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
      if (!text.includes('telemetry') && !text.includes('Sensor') && !text.includes('Download')) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Stealth plugin handles most UA/fingerprint masking
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    let capturedResponse: any = null;
    let validateId: string | null = null;

    page.on('response', async (response: any) => {
      const url = response.url();
      if (url.includes("/bapi/accounts/v1/public/account/security/request/precheck")) {
        try {
          const json = await response.json();
          if (json.data && json.data.validateId) {
            validateId = json.data.validateId;
            console.log(`[DEBUG] Captured validateId: ${validateId}`);
          }
        } catch (e) { }
      }
      if (url.includes("/bapi/accounts/v1/public/account/mobile/sendMobileVerifyCode")) {
        try {
          const json = await response.json();
          capturedResponse = json;
        } catch (e) { }
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
        const title = await page.title();
        
        if (status === 404 || status === 403 || content.includes("Not Found") || content.includes("Access Denied") || content.includes("Blocked") || title.includes("Not Found")) {
          console.log(`[DEBUG] Mirror ${mirror} failed. Status: ${status}, Title: "${title}", URL: ${page.url()}`);
          continue;
        }

        navigated = true;
        console.log(`[SUCCESS] Landed on ${mirror}`);
      } catch (gotoError: any) {
        console.log(`[DEBUG] Mirror ${mirror} failed: ${gotoError.message}`);
      }
    }

    if (!navigated) {
      await browser.close();
      return {
        capturedResponse: null,
        error: "CRITICAL: All mirrors failed to load even with 90s timeouts. This suggests a total network block or VPN issue."
      };
    }

    // Wait for the page to stabilize after potential internal redirects/hydration
    console.log("Waiting for page hydration (10s)...");
    await new Promise(r => setTimeout(r, 10000));

    // Diagnostic Layout Scan
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ p: i.placeholder, n: i.name, t: i.type }));
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
      console.log(`[LAYOUT SCAN] Inputs: ${JSON.stringify(inputs)}`);
      console.log(`[LAYOUT SCAN] Buttons: ${JSON.stringify(buttons)}`);
    });

    // --- COUNTRY CODE SELECTION ---
    console.log(`Setting country code to: +${callingCode}`);
    try {
      const countrySelector = '.bn-input-prefix, [class*="prefix" i], .country-code, [data-testid="country-code-select"], .bn-input-prefix-icon';
      
      let countryApplied = false;
      for (let i = 0; i < 3; i++) {
        try {
          await page.waitForSelector(countrySelector, { timeout: 10000 });
          await page.click(countrySelector);
          await new Promise(r => setTimeout(r, 1000));
          
          await page.keyboard.type(callingCode);
          await new Promise(r => setTimeout(r, 1500));
          await page.keyboard.press('Enter');
          countryApplied = true;
          console.log(`[DEBUG] Country code +${callingCode} applied.`);
          break;
        } catch (selectionErr: any) {
          console.log(`[DEBUG] Country selection attempt ${i+1} failed: ${selectionErr.message}.`);
          // If we fail, try to click the first element that looks like a country picker
          await page.evaluate(() => {
            const el = document.querySelector('.bn-input-prefix') as HTMLElement;
            if (el) el.click();
          });
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!countryApplied) {
         console.log(`[DEBUG] Could not set country code via selector. Trying generic click on prefix icon...`);
      }
    } catch (e: any) {
      console.log(`[DEBUG] Country selection logic skipped: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));

    // Interact with the UI to trigger the API call
    console.log(`Entering mobile number: ${mobile}`);
    const inputSelector = 'input[type="tel"], input[name="mobile"], input[placeholder*="phone" i], input[placeholder*="mobile" i]';

    try {
      await page.waitForSelector(inputSelector, { timeout: 15000 });
      await page.focus(inputSelector);

      // Clear input
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');

      // Type with human-like delay
      for (const char of mobile) {
        await page.keyboard.sendCharacter(char);
        await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
      }

      console.log("[DEBUG] Phone number typed. Searching for 'Next' button...");
      await new Promise(r => setTimeout(r, 3000));

      // Click "Next" with more robust selection
      const buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => {
          const text = b.textContent?.toLowerCase() || '';
          return (
            text.includes('next') ||
            text.includes('create') ||
            text.includes('sign up') ||
            text.includes('continue') ||
            b.getAttribute('type') === 'submit'
          ) && !b.disabled;
        });
        
        if (nextBtn) {
          console.log(`[DEBUG] Clicking button with text: ${nextBtn.textContent?.trim()}`);
          nextBtn.click();
          return true;
        }
        return false;
      });

      if (!buttonClicked) {
        console.log("[DEBUG] 'Next' button not found via text. Trying generic submit...");
        await page.keyboard.press('Enter');
      }

      // --- CAPTCHA SOLVING LOGIC ---
      if (captchaKey) {
        console.log("Monitoring for CAPTCHA challenge...");

        const searchStartTime = Date.now();
        while (!validateId && Date.now() - searchStartTime < 25000) {
          await new Promise(r => setTimeout(r, 1000));
        }

        if (validateId) {
          console.log("CAPTCHA detected via API. Attempting to solve...");
          const captchaService = new CaptchaService(captchaKey);
          const solution = await captchaService.solveBinanceCaptcha(page.url(), "register", validateId);
          if (solution) console.log("Captcha solved. Proceeding...");
        } else {
          console.log("No CAPTCHA challenge detected (or timeout).");
        }
      }

      // Wait for the background call
      console.log("Waiting for final verification response (30s)...");
      const startTime = Date.now();
      while (!capturedResponse && Date.now() - startTime < 30000) {
        await new Promise(r => setTimeout(r, 1000));
        
        const pageError = await page.evaluate(() => {
          const errorSelectors = ['.bn-feedback-error', '[class*="error" i]', '[class*="feedback" i]'];
          for (const sel of errorSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent?.trim()) return el.textContent.trim();
          }
          return null;
        });

        if (pageError) {
          console.log(`[DEBUG] Page error detected: ${pageError}`);
          break;
        }
      }
    } catch (uiError: any) {
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      console.log(`UI interaction interrupted. Content preview: "${pageText.replace(/\n/g, ' ')}"`);
      console.log(`Error: ${uiError.message}`);
    }

    await browser.close();
    return { capturedResponse };

  } catch (error: any) {
    if (browser) await browser.close();
    return {
      capturedResponse: null,
      error: error.message || "Puppeteer Stealth Service Error"
    };
  }
}
