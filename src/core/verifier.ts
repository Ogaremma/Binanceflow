import { formatPhone } from "../utils/phoneFormatter.js";
import { checkBinanceRegistration } from "../providers/binanceProvider.js";
import { VerificationStatus } from "../types/verificationStatus.js";

export interface VerificationResult {
  phone: string;
  formatted: { callingCode: string; mobile: string };
  status: VerificationStatus;
  rawResponse?: any;
  error?: string;
}

/**
 * Orchestrates the phone formatting and provider verification logic.
 */
export async function verifyPhoneRegistration(phoneNumber: string, captchaKey?: string): Promise<VerificationResult> {
  // Parse and validate phone
  const formatted = formatPhone(phoneNumber);

  if (!formatted.isValid) {
    return {
      phone: phoneNumber,
      formatted: { callingCode: formatted.callingCode, mobile: formatted.mobile },
      status: "UNKNOWN",
      error: "Global Database Check: This number is mathematically invalid (too long, too short, or missing country code)."
    };
  }

  // Call the Binance provider
  const providerResult = await checkBinanceRegistration(formatted.callingCode, formatted.mobile, captchaKey);

  // Construct the final result
  return {
    phone: phoneNumber,
    formatted,
    status: providerResult.status,
    rawResponse: providerResult.rawResponse,
    error: providerResult.error
  };
}
