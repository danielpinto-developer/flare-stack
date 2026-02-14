/**
 * FLARE STACK — Test Routing Command
 *
 * `flare test-routing` — Validate the ticket router against known-good test cases.
 *
 * Reads routing-tests.json from the project root, fetches each ticket from Jira,
 * runs the full routing pipeline, and compares results to expected values.
 *
 * This lets you validate prompt changes WITHOUT running the full init → ignite cycle.
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadConfig } from "../config/loader.js";
import type { FlareConfig } from "../config/schema.js";
import { routeTickets } from "../core/ticket-router.js";
import { JiraMcpSource } from "../sources/jira-mcp-source.js";
import type { Ticket } from "../sources/types.js";
import type { RepoConfig } from "../config/schema.js";

interface RoutingTestCase {
  ticket: string;
  expectedRepo: string;
  expectedBranch: string;
}

/**
 * Create the Jira MCP ticket source for fetching issues.
 */
function createJiraSource(config: FlareConfig): JiraMcpSource {
  const repoNames = Object.keys(config.repos);
  const firstRepo = repoNames[0] || "unknown";
  const firstBranch =
    (config.repos[firstRepo] as RepoConfig)?.branches?.[0] || "develop";

  return new JiraMcpSource(
    config.jira.mcpServer,
    config.jira.cloudId!,
    config.jira.projectKeys,
    firstRepo,
    firstBranch,
    config.jira.queueStatus,
    config.jira.siteUrl,
  );
}

export const testRoutingCommand = new Command("test-routing")
  .description(
    "🧪 Validate ticket routing against known-good test cases (routing-tests.json)",
  )
  .option(
    "-f, --file <path>",
    "Path to routing test cases JSON file",
    "routing-tests.json",
  )
  .action(async (options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🧪 FLARE STACK — Routing Test Runner\n"));

    // Load test cases
    const testFile = join(process.cwd(), options.file);
    if (!existsSync(testFile)) {
      console.error(chalk.red(`\n   ❌ Test file not found: ${testFile}`));
      console.error(
        chalk.yellow(
          `\n   Create a routing-tests.json file with your test cases:\n` +
            `   [\n` +
            `     { "ticket": "IW-6034", "expectedRepo": "inno", "expectedBranch": "feature/ciwp-cohort" }\n` +
            `   ]\n`,
        ),
      );
      process.exit(1);
    }

    let testCases: RoutingTestCase[];
    try {
      testCases = JSON.parse(readFileSync(testFile, "utf-8"));
    } catch {
      console.error(chalk.red(`   ❌ Invalid JSON in ${testFile}`));
      process.exit(1);
    }

    console.log(
      chalk.gray(
        `   📄 Loaded ${testCases.length} test case(s) from ${options.file}\n`,
      ),
    );

    // Fetch all tickets from Jira in a single connection
    // SIGINT trap: the MCP subprocess can propagate SIGINT during disconnect
    const origSigint = process.listeners("SIGINT");
    process.removeAllListeners("SIGINT");
    const sigintTrap = () => {
      /* suppress SIGINT from MCP subprocess */
    };
    process.on("SIGINT", sigintTrap);

    const jiraSource = createJiraSource(config);
    const ticketIds = testCases.map((tc) => tc.ticket);
    console.log(
      chalk.gray(`   🔗 Fetching ${ticketIds.length} ticket(s) from Jira...\n`),
    );

    let tickets: Ticket[];
    try {
      tickets = await jiraSource.fetchIssues(ticketIds);
      for (const t of tickets) {
        console.log(
          chalk.green(`   ✅ ${t.id} — ${t.summary || "(no summary)"}`),
        );
      }
    } catch (err) {
      console.error(chalk.red(`   ❌ Failed to fetch tickets: ${err}`));
      process.exit(1);
    }

    // Restore original SIGINT handlers
    process.removeListener("SIGINT", sigintTrap);
    for (const listener of origSigint) {
      process.on("SIGINT", listener as NodeJS.SignalsListener);
    }

    if (tickets.length === 0) {
      console.error(chalk.red("\n   ❌ No tickets fetched. Exiting.\n"));
      process.exit(1);
    }

    // Run the routing pipeline
    console.log(chalk.cyan("\n   🧠 Running routing pipeline...\n"));
    const routed = await routeTickets(tickets, config);

    // Compare results
    console.log(chalk.cyan.bold("\n" + "═".repeat(60)));
    console.log(chalk.cyan.bold("   📊 ROUTING TEST RESULTS"));
    console.log(chalk.cyan.bold("═".repeat(60) + "\n"));

    let passed = 0;
    let failed = 0;

    for (const tc of testCases) {
      const routedTicket = routed.find((t) => t.id === tc.ticket);
      if (!routedTicket) {
        console.log(chalk.yellow(`   ⚠️  ${tc.ticket}: NOT ROUTED (skipped)`));
        failed++;
        continue;
      }

      const repoMatch = routedTicket.targetRepo === tc.expectedRepo;
      const branchMatch = routedTicket.sourceBranch === tc.expectedBranch;
      const pass = repoMatch && branchMatch;

      if (pass) {
        console.log(
          chalk.green(
            `   ✅ ${tc.ticket}: ${routedTicket.targetRepo}/${routedTicket.sourceBranch} — PASS`,
          ),
        );
        passed++;
      } else {
        console.log(chalk.red(`   ❌ ${tc.ticket}: FAIL`));
        if (!repoMatch) {
          console.log(
            chalk.red(
              `      Repo:   got "${routedTicket.targetRepo}" expected "${tc.expectedRepo}"`,
            ),
          );
        }
        if (!branchMatch) {
          console.log(
            chalk.red(
              `      Branch: got "${routedTicket.sourceBranch}" expected "${tc.expectedBranch}"`,
            ),
          );
        }
        failed++;
      }
    }

    // Summary
    console.log(chalk.cyan("\n" + "─".repeat(60)));
    const total = passed + failed;
    if (failed === 0) {
      console.log(chalk.green.bold(`\n   🎉 ALL ${total} TEST(S) PASSED!\n`));
    } else {
      console.log(
        chalk.red.bold(
          `\n   💔 ${failed}/${total} FAILED — ${passed}/${total} passed\n`,
        ),
      );
      process.exit(1);
    }
  });
