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
export async function verifyPhoneRegistration(phoneNumber: string): Promise<VerificationResult> {
  // Parse and format phone
  const formatted = formatPhone(phoneNumber);

  // Call the Binance provider
  const providerResult = await checkBinanceRegistration(formatted.callingCode, formatted.mobile);

  // Construct the final result
  return {
    phone: phoneNumber,
    formatted,
    status: providerResult.status,
    rawResponse: providerResult.rawResponse,
    error: providerResult.error
  };
}
