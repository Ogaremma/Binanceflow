# Binance Phone Checker CLI

A Node.js/TypeScript CLI tool that checks the possible registration status of a phone number using the public registration flow of the Binance platform. 

## Importance Notice
This tool is for educational purposes to demonstrate request analysis and response interpretation. It **does not** attempt to bypass security protections (e.g., CAPTCHA, rate limits, automation defenses).

## How It Works
1. Analyzes a given phone number and normalizes it.
2. Constructs a minimal payload (similar to the Binance web frontend's SMS sending process).
3. Interprets the HTTP response returned by the `sendMobileVerifyCode` endpoint.
4. Outputs one of four possible statuses:
   - `REGISTERED`: Appears already tied to an account.
   - `NOT_REGISTERED`: SMS sent successfully (number is available).
   - `UNKNOWN`: The response is inconclusive (e.g., rate limits, varying payloads).
   - `ERROR`: A network or system fault occurred.

## Prerequisite
- Node.js (v16+)
- TypeScript

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```

## Usage

You can use the built output directly:
```bash
npm start -- +2347012345678
```

Or use the dev script (ts-node):
```bash
npm run dev -- +2347012345678
```

### Example Output
```
Checking Binance registration status...

Phone: +2347012345678
Status: UNKNOWN
Source: Binance registration flow

Possible Status Values:

REGISTERED
NOT_REGISTERED
UNKNOWN
ERROR
```
