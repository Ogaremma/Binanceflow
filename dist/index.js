#!/usr/bin/env node
import { createCLI } from "./cli/index.js";
async function main() {
    const cli = createCLI();
    await cli.parseAsync(process.argv);
}
main().catch((err) => {
    console.error("An unexpected error occurred:", err);
    process.exit(1);
});
