/**
 * Utility to normalize and validate phone numbers globally using ITU-T E.164 standards.
 */
export function formatPhone(phone: string): { callingCode: string; mobile: string; isValid: boolean } {
  // Remove non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");
  const hasPlus = cleaned.startsWith("+");
  
  if (hasPlus) cleaned = cleaned.substring(1);

  // ITU-T E.164 Country Code to Length Map
  // Lengths are for the NATIONAL (significant) number (mobile/landline without country code)
  const countryRules: Record<string, number[]> = {
    "234": [10],      // Nigeria
    "1": [10],        // US/Canada
    "44": [10],       // UK
    "49": [10, 11],   // Germany
    "33": [9],        // France
    "91": [10],       // India
    "86": [11],       // China
    "7": [10],        // Russia/Kazakhstan
    "81": [10],       // Japan
    "82": [10],       // South Korea
    "61": [9],        // Australia
    "55": [10, 11],   // Brazil
    "34": [9],        // Spain
    "39": [10],       // Italy
    "65": [8],        // Singapore
    "971": [9],       // UAE
  };

  // 1. Nigerian Local Format (starts with 0, must be 11 digits total)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return { callingCode: "234", mobile: cleaned.substring(1), isValid: true };
  }

  // 2. Identify Country Code and Validate
  // We check prefixes from longest (3 digits) to shortest (1 digit)
  for (let i = 3; i >= 1; i--) {
    const code = cleaned.substring(0, i);
    const rules = countryRules[code];
    
    if (rules) {
      const mobileSub = cleaned.substring(i);
      const isCorrectLength = rules.includes(mobileSub.length);
      
      // Basic sanity check: mobile shouldn't start with impossible digits if known
      // e.g., Nigerian mobile numbers usually start with 7, 8, or 9
      if (code === "234" && !["7", "8", "9"].includes(mobileSub[0])) {
         return { callingCode: code, mobile: mobileSub, isValid: false };
      }

      return { 
        callingCode: code, 
        mobile: mobileSub, 
        isValid: isCorrectLength 
      };
    }
  }

  // 3. Global Fallback (If not in our specific rules)
  // E.164 allows 7-15 total digits. Without a specific rule, we fallback to range check.
  // But we require a + for non-local numbers to be "valid" in this tool's context.
  const totalLength = cleaned.length;
  const isPossible = totalLength >= 10 && totalLength <= 15;

  return { 
    callingCode: cleaned.substring(0, 2), // Theoretical extraction
    mobile: cleaned.substring(2),
    isValid: hasPlus && isPossible 
  };
}
