import { Command } from "commander";
import { verifyPhoneRegistration } from "../core/verifier.js";

export function createCLI() {
  const program = new Command();

  program
    .name("check-binance-phone")
    .description("CLI tool to check Binance registration status of a phone number")
    .version("1.0.0")
    .argument("<phone>", "Phone number to check (e.g., +2347012345678)")
    .option("--debug", "Show raw API response")
    .option("--captcha-key <key>", "CapMonster Cloud API Key for solving CAPTCHAs")
    .action(async (phone: string, options: { debug?: boolean, captchaKey?: string }) => {
      console.log(`Checking Binance registration status...\n`);

      const key = options.captchaKey || process.env.CAPMONSTER_API_KEY;
      const result = await verifyPhoneRegistration(phone, key);

      console.log(`Phone: ${result.phone}`);
      console.log(`Status: ${result.status}`);
      console.log(`Source: Binance registration flow\n`);

      if (options.debug || result.status === "UNKNOWN" || result.status === "ERROR") {
        console.log(`--- DEBUG INFO ---`);
        if (result.error) console.log(`Error: ${result.error}`);
        
        if (result.rawResponse) {
          console.log(`Raw Response Data:`);
          console.log(JSON.stringify(result.rawResponse, null, 2));
        }
        console.log(`------------------\n`);
      }
    });

  return program;
}
