/**
 * FLARE STACK — Config Loader
 *
 * Uses cosmiconfig to discover flare.config.ts/.js/.json/.yaml
 * from the current directory or parent directories.
 */
import { cosmiconfig } from "cosmiconfig";
import { FlareConfigSchema, type FlareConfig } from "./schema.js";
import { resolve } from "path";
import chalk from "chalk";

const MODULE_NAME = "flare";

const explorer = cosmiconfig(MODULE_NAME, {
  searchPlaces: [
    "flare.config.ts",
    "flare.config.js",
    "flare.config.json",
    "flare.config.yaml",
    "flare.config.yml",
    ".flarerc",
    ".flarerc.json",
    ".flarerc.yaml",
    "package.json",
  ],
});

let cachedConfig: FlareConfig | null = null;

/**
 * Load and validate the flare configuration.
 * Searches from CWD upward for flare.config.ts or equivalent.
 */
export async function loadConfig(configPath?: string): Promise<FlareConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    let result = configPath
      ? await explorer.load(resolve(configPath))
      : await explorer.search();

    // Fallback: if CWD is inside a chambers directory, search sibling dirs
    if ((!result || result.isEmpty) && !configPath) {
      const cwd = process.cwd();
      const parts = cwd.split("/");
      // Look for "flare-chambers" in the path
      const chambersIdx = parts.indexOf("flare-chambers");
      if (chambersIdx > 0) {
        const parentDir = parts.slice(0, chambersIdx).join("/");
        // Search from the parent directory (where sibling repos live)
        const { readdirSync, statSync } = await import("fs");
        const siblings = readdirSync(parentDir);
        for (const sibling of siblings) {
          if (sibling === "flare-chambers") continue;
          const siblingPath = `${parentDir}/${sibling}`;
          try {
            if (!statSync(siblingPath).isDirectory()) continue;
          } catch {
            continue;
          }
          const sibResult = await explorer.search(siblingPath);
          if (sibResult && !sibResult.isEmpty) {
            result = sibResult;
            break;
          }
        }
      }
    }

    if (!result || result.isEmpty) {
      console.error(
        chalk.red("❌ No flare.config.ts found."),
        chalk.yellow("\nRun"),
        chalk.cyan("flare init"),
        chalk.yellow("to create one."),
      );
      process.exit(1);
    }

    // Handle default export from TS config
    const rawConfig = result.config?.default ?? result.config;

    // Validate + apply defaults via Zod
    const parsed = FlareConfigSchema.safeParse(rawConfig);

    if (!parsed.success) {
      console.error(chalk.red("❌ Invalid flare.config.ts:"));
      for (const issue of parsed.error.issues) {
        console.error(
          chalk.yellow(`  → ${issue.path.join(".")}: ${issue.message}`),
        );
      }
      process.exit(1);
    }

    // Resolve relative paths to absolute
    const config = resolveConfigPaths(parsed.data, result.filepath);

    // Load .env from the config file's directory (critical when running from chambers)
    const configDir = resolve(result.filepath, "..");
    const { config: loadDotenv } = await import("dotenv");
    const { existsSync: envExists } = await import("fs");

    // Load .env files from config directory + server/client subdirs
    for (const envPath of [
      `${configDir}/.env`,
      `${configDir}/server/.env`,
      `${configDir}/client/.env`,
    ]) {
      if (envExists(envPath)) {
        loadDotenv({ path: envPath, override: false }); // don't override existing
      }
    }

    // Also load .env from source repo paths (critical when config was copied into a chamber)
    for (const [, repo] of Object.entries(config.repos)) {
      const repoPath = repo.path;
      if (!repoPath || repoPath === configDir) continue;
      for (const envPath of [
        `${repoPath}/.env`,
        `${repoPath}/server/.env`,
        `${repoPath}/client/.env`,
      ]) {
        if (envExists(envPath)) {
          loadDotenv({ path: envPath, override: false });
        }
      }
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    console.error(chalk.red("❌ Failed to load config:"), error);
    process.exit(1);
  }
}

/**
 * Resolve relative paths in the config to absolute paths.
 */
function resolveConfigPaths(
  config: FlareConfig,
  configFilePath: string,
): FlareConfig {
  const configDir = resolve(configFilePath, "..");

  // Resolve workspacesDir
  if (!config.workspacesDir.startsWith("/")) {
    config.workspacesDir = resolve(configDir, config.workspacesDir);
  }

  // Resolve repo paths
  for (const [, repo] of Object.entries(config.repos)) {
    if (!repo.path.startsWith("/")) {
      repo.path = resolve(configDir, repo.path);
    }
    if (repo.codeReviewPrompt && !repo.codeReviewPrompt.startsWith("/")) {
      repo.codeReviewPrompt = resolve(configDir, repo.codeReviewPrompt);
    }
  }

  return config;
}

/**
 * Clear the config cache (useful for testing).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
