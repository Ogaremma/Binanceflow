import { VerificationStatus } from "../types/verificationStatus.js";
import { executeBinancePuppeteerCheck } from "../services/puppeteerService.js";

export interface ProviderResponse {
  status: VerificationStatus;
  rawResponse: any;
  error?: string;
}

/**
 * Orchestrates the registration check by calling the Puppeteer service
 * and analyzing the captured network response.
 */
export async function checkBinanceRegistration(callingCode: string, mobile: string, captchaKey?: string): Promise<ProviderResponse> {
  try {
    const { capturedResponse, error } = await executeBinancePuppeteerCheck(mobile, captchaKey);

    if (error) {
      return {
        status: "UNKNOWN",
        rawResponse: null,
        error: `Puppeteer Error: ${error}`
      };
    }

    if (!capturedResponse) {
      return {
        status: "UNKNOWN",
        rawResponse: null,
        error: "No response detected from Binance API within the timeout period."
      };
    }

    return {
      status: analyzeResponse(capturedResponse),
      rawResponse: capturedResponse
    };

  } catch (err: any) {
    // Catch-all to ensure any unexpected error (DNS, network, etc.) results in UNKNOWN
    return {
      status: "UNKNOWN",
      rawResponse: err,
      error: err.message || "Unknown Provider Error"
    };
  }
}

/**
 * Analyzes the raw API response and maps it to a VerificationStatus.
 */
function analyzeResponse(response: any): VerificationStatus {
  const code = String(response.code || "");
  const message = String(response.message || response.msg || "").toLowerCase();

  // If response code is "000000", it means the mobile verify code can be sent (not registered)
  if (code === "000000") {
    return "NOT_REGISTERED";
  }

  // If message indicates existence, it's registered
  // Examples: "Mobile already exist", "User exists", etc.
  if (message.includes("exist")) {
    return "REGISTERED";
  }

  // Known registration conflict codes
  // 114004: User already exists
  // 200001007: Mobile already registered
  if (code === "114004" || code === "200001007") {
    return "REGISTERED";
  }

  return "UNKNOWN";
}
