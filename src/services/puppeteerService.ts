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
export async function executeBinancePuppeteerCheck(mobile: string, captchaKey?: string): Promise<PuppeteerCheckResult> {
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
      '--host-resolver-rules=MAP *.binance.com 13.248.148.169, MAP *.binance.me 15.197.202.122, MAP *.binance.info 76.223.23.250, MAP *.binance.cloud 76.223.23.250',
      '--enable-features=HostResolverRules'
    ]
  });

  const mirrors = [
    "https://accounts.binance.com/en/register",
    "https://www.binance.com/en/register",
    "https://accounts.binance.me/en/register",
    "https://accounts.binance.info/en/register"
  ];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    // Stealth plugin handles most UA/fingerprint masking, but we'll set a high-quality one
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    let capturedResponse: any = null;
    let validateId: string | null = null;

    page.on('response', async (response: any) => {
      const url = response.url();

      // Intercept the precheck call to get the validateId
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

    // Navigate with a generous timeout and relaxed wait condition
    let navigated = false;
    for (const mirror of mirrors) {
      if (navigated) break;
      console.log(`Navigating to Binance registration (${mirror})...`);
      try {
        await page.goto(mirror, {
          // 'commit' is the lighter condition, fires when navigation is committed
          waitUntil: 'domcontentloaded',
          timeout: 90000 // Increased to 90s for VPN/Stealth latency
        });
        navigated = true;
      } catch (gotoError: any) {
        console.log(`Navigation to ${mirror} failed: ${gotoError.message}`);
      }
    }

    if (!navigated) {
      await browser.close();
      return {
        capturedResponse: null,
        error: "CRITICAL: All mirrors failed to load even with 90s timeouts. This suggests a total network block or VPN issue."
      };
    }

    // Human-like wait after load
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

    // Interact with the UI to trigger the API call
    console.log(`Entering mobile number: ${mobile}`);
    const inputSelector = 'input[type="tel"], input[name="mobile"], input[placeholder*="phone" i]';

    try {
      await page.waitForSelector(inputSelector, { timeout: 30000 });
      await page.focus(inputSelector);

      // Type with human-like delay
      for (const char of mobile) {
        await page.keyboard.sendCharacter(char);
        await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
      }

      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

      // Click "Next"
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b =>
          b.textContent?.toLowerCase().includes('next') ||
          b.textContent?.toLowerCase().includes('create') ||
          b.getAttribute('type') === 'submit'
        );
        if (nextBtn) nextBtn.click();
      });

      // --- CAPTCHA SOLVING LOGIC ---
      if (captchaKey) {
        console.log("Monitoring for CAPTCHA challenge...");

        // Wait up to 15 seconds for a CAPTCHA to appear or validateId to be caught
        const searchStartTime = Date.now();
        while (!validateId && Date.now() - searchStartTime < 15000) {
          await new Promise(r => setTimeout(r, 1000));
        }

        if (validateId) {
          console.log("CAPTCHA detected via API. Attempting to solve with CapMonster...");
          const captchaService = new CaptchaService(captchaKey);

          const websiteKey = "register";
          const solution = await captchaService.solveBinanceCaptcha(page.url(), websiteKey, validateId);

          if (solution) {
            console.log("Captcha solved. Proceeding to final check...");
          }
        } else {
          console.log("No CAPTCHA challenge detected by the API.");
        }
      }
      // ----------------------------

      // Wait for the background call
      console.log("Waiting for final verification response...");
      const startTime = Date.now();
      while (!capturedResponse && Date.now() - startTime < 15000) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (uiError: any) {
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      console.log(`UI interaction failed. Page content preview: "${pageText.replace(/\n/g, ' ')}"`);
      console.log(`UI interaction interrupted: ${uiError.message}`);
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
