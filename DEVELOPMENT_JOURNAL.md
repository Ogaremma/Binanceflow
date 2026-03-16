# Engineering Journal: Building the Binance Registration Validator

So, I’ve been working on this project to solve a pretty specific problem: how do we reliably tell if a phone number is registered on Binance without having access to an official API? It turned out to be a massive rabbit hole of network spying, UI hacking, and global phone number math. 

Here’s the breakdown of how I built this and the hurdles I had to hop over.

---

## 1. The Strategy: Path of Least Resistance
Since Binance doesn't just hand out an "IsUserRegistered" endpoint, I had to simulate what a real person does: **The Registration Flow.**

The logic is simple: if you try to register a number that already exists, Binance will either:
- Block you with an error saying "User already exists".
- Prompt you for a password (because it knows you).
- Send an OTP if it's a "New" user.

The goal was to catch these signals in the background while the browser does its thing.

## 2. The Tech Stack
I went with **Node.js** and **TypeScript** for the core logic, using **Puppeteer** (extra stealth) as the engine. Since Binance uses pretty advanced bot detection (BIDS), I had to pull out the stealth plugins and simulate human-like typing speeds.

## 3. The Big Challenges (and how I fixed them)

### A. The "Privacy Notice" Overlay
This was the most annoying part. Binance has a "Privacy Notice" checkbox that you *must* tick before the "Continue" button works. 
- **The Problem**: Standard `.click()` calls kept failing because there were transparent overlays or complex DOM layers blocking the interaction.
- **The Fix**: I implemented a **Hardware Mouse Interaction**. Instead of asking the browser to click an element, I calculated the exact $(x, y)$ pixel coordinates of the checkbox and told the mouse to click that specific spot. 

### B. Network Response Spying
I couldn't just look at the screen; I had to see what the "brain" of the website was saying.
- **The Logic**: I set up a network listener that specifically looks for URLs containing `/bapi/`. 
- **The Signature**: I found that code `114004` or `102203001` usually means "User Exists," while code `000000` on the `sendMobileVerifyCode` endpoint means the number is fresh and available.

### C. The "Fake Number" Problem (UNKNOWN vs. NOT_REGISTERED)
Originally, the tool said "Not Registered" for *everything* that wasn't on Binance—including fake numbers like `+123456`. That’s bad data.
- **The Fix**: I built a **Global Mathematical Validator**. I hardcoded ITU-T E.164 rules for major countries (Nigeria, UK, US, Germany, etc.). Now, if a number is mathematically impossible (like a 5-digit number), the tool flags it as `UNKNOWN` immediately. It only asks Binance about "Real" looking numbers.

### D. Visual Cues as a Fallback
Sometimes the network signature is tricky. I added a layer that scans the actual UI:
- If a **Password Field** appears -> It’s `REGISTERED`.
- If a red error says **"Already in use"** -> It’s `REGISTERED`.

## 4. Final Architecture

- **`phoneFormatter.ts`**: The "Brain" that validates phone lengths globally.
- **`puppeteerService.ts`**: The "Hands" that navigate, click the invisible checkboxes, and reset the capture state right before clicking "Continue" to avoid catching old data.
- **`binanceProvider.ts`**: The "Translator" that maps weird Binance error codes into human-readable statuses like `REGISTERED` or `NOT_REGISTERED`.

---

## How to test it properly:

1. **Invalid Number**: `+234123` -> Returns `UNKNOWN`.
2. **Real but Fresh Number**: `+23470xxxxxx` -> Returns `NOT_REGISTERED`.
3. **Existing Account**: Your own number -> Returns `REGISTERED`.

The terminal is now super clean—no more messy "Network Spy" logs. It just gives you the final answer after it's done "cracking" the UI.
