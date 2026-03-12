import { formatPhone } from "../utils/phoneFormatter.js";
import { checkBinanceRegistration } from "../providers/binanceProvider.js";
/**
 * Orchestrates the phone formatting and provider verification logic.
 */
export async function verifyPhoneRegistration(phoneNumber) {
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
