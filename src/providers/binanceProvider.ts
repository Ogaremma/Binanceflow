import axios from "axios";
import { VerificationStatus } from "../types/verificationStatus.js";

const BINANCE_SEND_SMS_URL = "https://accounts.binance.com/bapi/accounts/v1/public/account/mobile/sendMobileVerifyCode";

export interface ProviderResponse {
  status: VerificationStatus;
  rawResponse: any;
  error?: string;
}

/**
 * Sends a request to Binance's public SMS verification endpoint.
 * Interprets the response to determine if a phone number might be registered.
 */
export async function checkBinanceRegistration(callingCode: string, mobile: string): Promise<ProviderResponse> {
  try {
    const payload = {
      mobile,
      callingCode,
      msgType: "TEXT",
      bizScene: "REGISTER"
    };

    const response = await axios.post(BINANCE_SEND_SMS_URL, payload, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "clienttype": "web"
      },
      timeout: 10000
    });

    const data = response.data;
    const code = String(data.code || "");
    const msg = String(data.msg || "").toLowerCase();

    // Interpretation logic
    // Usually if bizScene is REGISTER, and number is already registered,
    // binance returns an error saying "user exists" or similar code.
    if (msg.includes("exist") || msg.includes("registered") || code === "114004" || code === "200001007") {
      return { status: "REGISTERED", rawResponse: data };
    }

    // Success sending sms means it's available to register
    if (data.success === true || code === "000000") {
      return { status: "NOT_REGISTERED", rawResponse: data };
    }

    // Case can't be strongly determined
    return { status: "UNKNOWN", rawResponse: data };

  } catch (error: any) {
    if (error.response && error.response.data) {
      const respData = error.response.data;
      const msg = String(respData.msg || "").toLowerCase();

      if (msg.includes("exist") || msg.includes("registered")) {
        return { status: "REGISTERED", rawResponse: respData };
      }

      return { status: "UNKNOWN", rawResponse: respData, error: error.message };
    }

    return {
      status: "UNKNOWN",
      rawResponse: null,
      error: error.message || "Network Error"
    };
  }
}
