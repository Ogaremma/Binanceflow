#!/usr/bin/env node
import dns from "node:dns";
import { createCLI } from "./cli/index.js";
import 'dotenv/config';

// Binance servers frequently blackhole IPv6 connections from Node.js
// Forcing IPv4 prevents socket connection timeouts
dns.setDefaultResultOrder("ipv4first");

async function main() {
  const cli = createCLI();
  await cli.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
