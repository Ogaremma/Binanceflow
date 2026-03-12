import { Command } from "commander";
import { verifyPhoneRegistration } from "../core/verifier.js";

export function createCLI() {
  const program = new Command();

  program
    .name("check-binance-phone")
    .description("CLI tool to check Binance registration status of a phone number")
    .version("1.0.0")
    .argument("<phone>", "Phone number to check (e.g., +2347012345678)")
    .action(async (phone: string) => {
      console.log(`Checking Binance registration status...\n`);

      const result = await verifyPhoneRegistration(phone);

      console.log(`Phone: ${result.phone}`);
      console.log(`Status: ${result.status}`);
      console.log(`Source: Binance registration flow\n`);

      console.log(`Possible Status Values:\n`);
      console.log(`REGISTERED`);
      console.log(`NOT_REGISTERED`);
      console.log(`UNKNOWN`);
      console.log(`ERROR\n`);

      if (result.status === "ERROR") {
        console.log(`Error details: ${result.error}\n`);
      }
    });

  return program;
}
