#!/usr/bin/env node
import { loadToken, schedulerConfig, triggerDiscovery } from "./lib.mjs";

try {
  const config = schedulerConfig();
  if (process.argv.includes("--check")) {
    await loadToken(config.tokenFile);
    console.log(JSON.stringify({ ok: true, schedulerId: config.scheduleId, triggerOrigin: config.triggerUrl.origin }));
  } else {
    console.log(JSON.stringify(await triggerDiscovery(config)));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown scheduler failure");
  process.exitCode = 1;
}
