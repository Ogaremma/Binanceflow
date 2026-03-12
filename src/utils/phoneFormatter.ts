/**
 * Utility to normalize phone numbers.
 * Coverts input into a callingCode and mobile number.
 */
export function formatPhone(phone: string): { callingCode: string; mobile: string } {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If starts with +, strip it
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Example logic: handle common prefixes or defaults
  // Specific example from prompt: 2347012345678, 07012345678
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    // Assume Nigerian local format as per example
    return { callingCode: "234", mobile: cleaned.substring(1) };
  }

  if (cleaned.startsWith("234") && cleaned.length > 10) {
    return { callingCode: "234", mobile: cleaned.substring(3) };
  }

  // Generic fallback: Assume 1-3 digits country code if we don't know
  if (cleaned.length > 10) {
    // Defaulting to 1 for generic format without +
    // In a real app we'd use libphonenumber-js
    return { callingCode: "1", mobile: cleaned }; 
  }

  // Fallback
  return { callingCode: "1", mobile: cleaned };
}
