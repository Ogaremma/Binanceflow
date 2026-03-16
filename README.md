# Binance Registration Validator

A highly refined tool built to solve a specific challenge: accurately determining if a phone number is registered on Binance without an official API. This is achieved by simulating the actual registration flow and interpreting real-time network signatures and UI changes.

---

## Technical Overview

The project works by acting as a "human-in-the-browser," navigating the Binance registration pages while simultaneously spying on the background network requests. 

### Key Features:
- **Global Validity Layer**: Before even hitting Binance, numbers are checked against ITU-T E.164 mathematical rules. If a number is too short, too long, or starts with impossible digits for its country, it’s flagged as **UNKNOWN** to save time and data.
- **Hardware-Level Interaction**: To bypass transparent overlays and complex UI blockers, the tool uses physical coordinate-based clicking to toggle privacy checkboxes.
- **Multi-Signal Detection**: Registration is confirmed by watching for specific API error codes (like `114004`) or visual cues such as the appearance of a password field or "Already in use" error messages.
- **Stealth Integration**: Uses advanced browser fingerprinting and human-like typing behaviors to avoid triggering WAF blocks.

---

## Setup & Build

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Build the Project**:
   ```bash
   npm run build
   ```

---

## How to Test

Testing follows three primary scenarios to ensure the data is accurate. 

### 1. The "Fake Number" Test
Since the tool uses strict global validation, any mathematically impossible number will be caught immediately.
```bash
npm run dev -- +12345
```
**Expected Result**: `UNKNOWN (Invalid Format)`

### 2. The "Fresh Number" Test
Test a number that is valid (correct length/prefix) but hasn't been registered on Binance.
```bash
npm run dev -- +2347042725612
```
**Expected Result**: `NOT_REGISTERED`

### 3. The "Existing account" Test
Test a known registered Binance account. The tool should detect either the registration conflict or the password prompt.
```bash
npm run dev -- [YOUR_BINANCE_NUMBER]
```
**Expected Result**: `REGISTERED`

---

## Project Structure
- `src/utils/phoneFormatter.ts`: Hardcoded E.164 rules for global validation.
- `src/services/puppeteerService.ts`: The browser engine and UI-cracking logic.
- `src/providers/binanceProvider.ts`: The logic that translates raw network results into meaningful statuses.
