import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const promptPath = path.join(projectRoot, "hermes", "prompts", "remaining-work.md");

await access(promptPath, constants.R_OK);

const child = spawn(
  "hermes",
  [
    "chat",
    "--oneshot",
    "--query-file",
    promptPath,
    "--toolsets",
    "terminal,delegation",
    "--format",
    "stream-json",
    "--source",
    "tool",
  ],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  },
);

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(
      "Hermes is not installed. Follow the official installation guide, run `hermes setup`, then retry `npm run hermes:orchestrate`.",
    );
    process.exitCode = 127;
    return;
  }

  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Hermes exited after signal ${signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
