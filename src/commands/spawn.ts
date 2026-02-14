/**
 * FLARE STACK — Spawn Command
 *
 * `flare ignite [ticketId]` — Create worktrees for tickets.
 * `flare ignite --queue` — Spawn all tickets from Jira.
 *
 * Interactive mode (no args): Arrow-key menu to choose mode + manual ticket entry.
 *
 * Jira integration via MCP (Atlassian MCP server, stdio transport).
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { relative } from "path";
import { loadConfig } from "../config/loader.js";
import { JiraMcpSource } from "../sources/jira-mcp-source.js";
import { createWorktree } from "../core/worktree-manager.js";
import { injectPrompts } from "../core/prompt-injector.js";
import type { Ticket, TicketSource } from "../sources/types.js";
import type { FlareConfig } from "../config/schema.js";
import { routeTickets } from "../core/ticket-router.js";

/**
 * Create the Jira MCP ticket source.
 */
function resolveTicketSource(
  config: FlareConfig,
  defaultRepo: string,
  firstBranch: string,
): TicketSource {
  console.log(chalk.cyan("🔗 Using Jira MCP source"));
  if (!config.jira.cloudId) {
    console.error(chalk.red("❌ Jira cloudId is required."));
    console.error(chalk.yellow("   Set jira.cloudId in flare.config.ts."));
    process.exit(1);
  }

  return new JiraMcpSource(
    config.jira.mcpServer,
    config.jira.cloudId,
    config.jira.projectKeys,
    defaultRepo,
    firstBranch,
    config.jira.queueStatus,
    config.jira.siteUrl,
  );
}

export const spawnCommand = new Command("ignite")
  .alias("spawn")
  .description("Create isolated worktree realities for tickets")
  .argument("[ticketId]", "Single ticket ID to spawn (e.g., PROJ-001)")
  .option("-q, --queue", "Spawn all tickets from Jira")
  .option("-r, --repo <repo>", "Target repo override")
  .option("-b, --branch <branch>", "Source branch override")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🚀 FLARE STACK — Spawning Realities\n"));

    // Ensure workspaces directory exists
    if (!existsSync(config.workspacesDir)) {
      await mkdir(config.workspacesDir, { recursive: true });
      console.log(
        chalk.yellow(`⚠️  Created workspaces: ${config.workspacesDir}`),
      );
    } else {
      console.log(
        chalk.green(`✅ Workspaces directory: ${config.workspacesDir}`),
      );
    }

    const firstRepo = Object.keys(config.repos)[0];
    if (!firstRepo) {
      console.error(chalk.red("❌ No repos configured in flare.config.ts"));
      console.error(chalk.yellow("   Add at least one repo to the repos map."));
      process.exit(1);
    }

    const repoConfig = config.repos[firstRepo];
    const firstBranch = repoConfig?.branches?.[0] || "develop";

    let tickets: Ticket[] = [];

    // --- Interactive mode: no args provided ---
    if (!ticketId && !options.queue) {
      const { select, input } = await import("@inquirer/prompts");

      const mode = await select({
        message: "How do you want to spawn?",
        choices: [
          {
            name: "📥 Pull all tickets from Jira queue",
            value: "queue",
          },
          {
            name: "🎯 Enter a single ticket ID",
            value: "single",
          },
          {
            name: "📝 Add tickets manually (one at a time)",
            value: "manual",
          },
        ],
      });

      if (mode === "queue") {
        const source = resolveTicketSource(
          config,
          firstRepo,
          firstBranch,
        ) as JiraMcpSource;
        const allTickets = await source.parse();

        if (allTickets.length === 0) {
          console.log(
            chalk.yellow("\n   ⚠️  No tickets in queue. Nothing to ignite."),
          );
          return;
        }

        // Checkbox picker with Jira links
        const { checkbox } = await import("@inquirer/prompts");
        const selected = await checkbox({
          message:
            "Select tickets to ignite (spacebar to toggle, enter to confirm):",
          choices: allTickets.map((t) => ({
            name: `${chalk.white.bold(t.id)}  ${chalk.gray(t.summary || "(no summary)")}  ${chalk.blue.underline(source.issueUrl(t.id))}`,
            value: t.id,
          })),
        });

        if (selected.length === 0) {
          console.log(chalk.yellow("\n   ⚠️  No tickets selected."));
          return;
        }

        tickets = allTickets.filter((t) => selected.includes(t.id));

        // Route tickets to correct repos via LLM
        tickets = await routeTickets(tickets, config);

        // Confirm branch for each routed ticket (LLM already suggested one)
        for (const t of tickets) {
          const repo = t.targetRepo || firstRepo;
          const repoCfg = config.repos[repo] as any;
          const branches: string[] = repoCfg?.branches || ["develop"];
          const suggested = t.sourceBranch || branches[0];
          if (branches.length > 1) {
            const branch = await select({
              message: chalk.yellow(
                `   🌿 Branch for ${chalk.bold(t.id)} → ${chalk.cyan(repo)}:`,
              ),
              choices: branches.map((b: string) => ({
                name: b === suggested ? `✅ ${b} (AI recommended)` : b,
                value: b,
              })),
              default: suggested,
            });
            t.sourceBranch = branch;
          }
        }
      } else if (mode === "single") {
        const id = await input({
          message: "Ticket ID:",
          validate: (v) => (v.trim() ? true : "Enter a valid ticket ID"),
        });

        const targetRepo = options.repo || firstRepo;
        const sourceBranch =
          options.branch ||
          config.repos[targetRepo]?.branches?.[0] ||
          firstBranch;

        tickets = await fetchSingleTicket(
          id.trim(),
          targetRepo,
          sourceBranch,
          config,
        );

        // Route via LLM (picks best repo + branch)
        tickets = await routeTickets(tickets, config);

        // Confirm branch with select picker
        for (const t of tickets) {
          const repo = t.targetRepo || firstRepo;
          const repoCfg = config.repos[repo] as any;
          const branches: string[] = repoCfg?.branches || ["develop"];
          if (branches.length > 1 || Object.keys(config.repos).length > 1) {
            const suggested = t.sourceBranch || branches[0];
            const branch = await select({
              message: chalk.yellow(
                `🌿 Branch for ${chalk.bold(t.id)} → ${chalk.cyan(repo)}:`,
              ),
              choices: branches.map((b: string) => ({
                name: b === suggested ? `✅ ${b} (AI recommended)` : b,
                value: b,
              })),
              default: suggested,
            });
            t.sourceBranch = branch;
          }
        }
      } else {
        // Manual mode: fetch each ticket from Jira, validate assignee, then route
        const targetRepo = options.repo || firstRepo;
        const sourceBranch =
          options.branch ||
          config.repos[targetRepo]?.branches?.[0] ||
          firstBranch;

        console.log(
          chalk.gray(
            '\n   Type ticket IDs one at a time. Enter "done" when finished.\n',
          ),
        );

        while (true) {
          const id = await input({
            message: `Ticket ID ${chalk.gray("(or 'done')")}:`,
          });

          if (id.trim().toLowerCase() === "done" || id.trim() === "") {
            break;
          }

          // Fetch real ticket from Jira to get assignee + full data
          if (config.jira?.cloudId) {
            try {
              const fetched = await fetchSingleTicket(
                id.trim(),
                targetRepo,
                sourceBranch,
                config,
              );

              if (fetched.length > 0) {
                const t = fetched[0];

                // Assignee validation safeguard
                if (t.assignee) {
                  console.log(
                    chalk.gray(
                      `   👤 Assigned to: ${chalk.white.bold(t.assignee)}`,
                    ),
                  );
                } else {
                  console.log(
                    chalk.yellow(
                      `   ⚠️  ${id.trim()} has no assignee — verify this is yours`,
                    ),
                  );
                  const { confirm } = await import("@inquirer/prompts");
                  const proceed = await confirm({
                    message: chalk.yellow(
                      `Proceed with unassigned ticket ${id.trim()}?`,
                    ),
                    default: false,
                  });
                  if (!proceed) {
                    console.log(chalk.gray(`   ⏭️  Skipped ${id.trim()}`));
                    continue;
                  }
                }

                tickets.push(t);
                console.log(
                  chalk.green(
                    `   ✅ Added ${t.id}${t.summary ? ` — ${t.summary}` : ""}`,
                  ),
                );
              }
            } catch (err) {
              console.log(
                chalk.yellow(
                  `   ⚠️  Could not fetch ${id.trim()} from Jira: ${err instanceof Error ? err.message : err}`,
                ),
              );
              // Fall back to manual stub
              tickets.push({
                id: id.trim(),
                targetRepo,
                sourceBranch,
                rawContent: `${id.trim()}\n\nSpawned via flare-stack CLI (manual entry — Jira fetch failed)`,
              });
              console.log(
                chalk.yellow(`   ⚠️  Added ${id.trim()} without Jira data`),
              );
            }
          } else {
            // No Jira config — push stub
            tickets.push({
              id: id.trim(),
              targetRepo,
              sourceBranch,
              rawContent: `${id.trim()}\n\nSpawned via flare-stack CLI (manual entry)`,
            });
            console.log(chalk.green(`   ✅ Added ${id.trim()}`));
          }
        }

        if (tickets.length === 0) {
          console.log(chalk.yellow("⚠️  No tickets added."));
          return;
        }

        // Route tickets via LLM (picks best repo + branch)
        tickets = await routeTickets(tickets, config);

        // Confirm branch with select picker
        for (const t of tickets) {
          const repo = t.targetRepo || firstRepo;
          const repoCfg = config.repos[repo] as any;
          const branches: string[] = repoCfg?.branches || ["develop"];
          if (branches.length > 1 || Object.keys(config.repos).length > 1) {
            const suggested = t.sourceBranch || branches[0];
            const branch = await select({
              message: chalk.yellow(
                `🌿 Branch for ${chalk.bold(t.id)} → ${chalk.cyan(repo)}:`,
              ),
              choices: branches.map((b: string) => ({
                name: b === suggested ? `✅ ${b} (AI recommended)` : b,
                value: b,
              })),
              default: suggested,
            });
            t.sourceBranch = branch;
          }
        }

        console.log(
          chalk.cyan(`\n   🔥 Spawning ${tickets.length} ticket(s)...\n`),
        );
      }
    } else if (options.queue) {
      // Queue mode: pull all tickets from Jira, then multi-select
      const source = resolveTicketSource(
        config,
        firstRepo,
        firstBranch,
      ) as JiraMcpSource;
      const allTickets = await source.parse();

      if (allTickets.length === 0) {
        console.log(
          chalk.yellow("\n   ⚠️  No tickets in queue. Nothing to ignite."),
        );
        return;
      }

      const { checkbox } = await import("@inquirer/prompts");
      const selected = await checkbox({
        message:
          "Select tickets to ignite (spacebar to toggle, enter to confirm):",
        choices: allTickets.map((t) => ({
          name: `${chalk.white.bold(t.id)}  ${chalk.gray(t.summary || "(no summary)")}  ${chalk.blue.underline(source.issueUrl(t.id))}`,
          value: t.id,
        })),
      });

      if (selected.length === 0) {
        console.log(chalk.yellow("\n   ⚠️  No tickets selected."));
        return;
      }

      tickets = allTickets.filter((t) => selected.includes(t.id));

      // Route tickets to correct repos via LLM
      tickets = await routeTickets(tickets, config);

      // Confirm branch for each routed ticket (LLM already suggested one)
      const { select: selectBranch2 } = await import("@inquirer/prompts");
      for (const t of tickets) {
        const repo = t.targetRepo || firstRepo;
        const repoCfg = config.repos[repo] as any;
        const branches: string[] = repoCfg?.branches || ["develop"];
        const suggested = t.sourceBranch || branches[0];
        if (branches.length > 1) {
          const branch = await selectBranch2({
            message: chalk.yellow(
              `   🌿 Branch for ${chalk.bold(t.id)} → ${chalk.cyan(repo)}:`,
            ),
            choices: branches.map((b: string) => ({
              name: b === suggested ? `✅ ${b} (AI recommended)` : b,
              value: b,
            })),
            default: suggested,
          });
          t.sourceBranch = branch;
        }
      }
    } else if (ticketId) {
      // Single ticket mode: fetch real ticket data from Jira
      const targetRepo = options.repo || firstRepo;
      const sourceBranch =
        options.branch ||
        config.repos[targetRepo]?.branches?.[0] ||
        firstBranch;

      tickets = await fetchSingleTicket(
        ticketId,
        targetRepo,
        sourceBranch,
        config,
      );

      // Route via LLM (picks best repo + branch)
      tickets = await routeTickets(tickets, config);

      // Confirm branch with select picker
      const { select: selectBranch } = await import("@inquirer/prompts");
      for (const t of tickets) {
        const repo = t.targetRepo || firstRepo;
        const repoCfg = config.repos[repo] as any;
        const branches: string[] = repoCfg?.branches || ["develop"];
        if (branches.length > 1 || Object.keys(config.repos).length > 1) {
          const suggested = t.sourceBranch || branches[0];
          const branch = await selectBranch({
            message: chalk.yellow(
              `🌿 Branch for ${chalk.bold(t.id)} → ${chalk.cyan(repo)}:`,
            ),
            choices: branches.map((b: string) => ({
              name: b === suggested ? `✅ ${b} (AI recommended)` : b,
              value: b,
            })),
            default: suggested,
          });
          t.sourceBranch = branch;
        }
      }
    }

    if (tickets.length === 0) {
      console.log(chalk.yellow("⚠️  No tickets found."));
      return;
    }

    // Process each ticket
    let success = 0;
    let failed = 0;
    const spawnedPaths: { ticketId: string; path: string }[] = [];

    for (const ticket of tickets) {
      console.log(
        chalk.cyan(`\n>> Processing [${ticket.id}] → [${ticket.targetRepo}]`),
      );

      const result = await createWorktree(ticket, config);

      if (result.success) {
        await injectPrompts(ticket, result.worktreePath, config);
        spawnedPaths.push({ ticketId: ticket.id, path: result.worktreePath });

        // Auto-transition: Dev Review → Dev Ready → In Progress
        if (config.jira.autoTransition && config.jira.cloudId) {
          try {
            const mcpSource = resolveTicketSource(
              config,
              ticket.targetRepo,
              ticket.sourceBranch,
            ) as JiraMcpSource;
            await mcpSource.autoTransitionToInProgress(ticket.id);
          } catch (err) {
            console.log(
              chalk.yellow(
                `   ⚠️  Auto-transition failed for ${ticket.id}: ${err instanceof Error ? err.message : err}`,
              ),
            );
          }
        }

        success++;
      } else {
        failed++;
      }
    }

    // Summary
    console.log(chalk.cyan.bold("\n✨ ORCHESTRATION COMPLETE"));
    console.log(chalk.green(`   ✅ ${success} realities spawned`));
    if (failed > 0) {
      console.log(chalk.red(`   ❌ ${failed} failed`));
    }
    console.log(chalk.gray(`   📂 ${config.workspacesDir}\n`));

    // Ask how to proceed
    if (spawnedPaths.length > 0) {
      const { select: selectMode } = await import("@inquirer/prompts");
      const mode = await selectMode({
        message: "How do you want to work?",
        choices: [
          {
            name: "🔥 This terminal — copy paths and jump between tickets here",
            value: "sequential",
          },
          {
            name: "⚡ Split terminals — open a new terminal tab for each ticket",
            value: "terminals",
          },
          {
            name: "🚀 Agent Manager — open each ticket in its own Antigravity IDE window",
            value: "agent-manager",
          },
        ],
      });

      if (mode === "sequential") {
        console.log(chalk.cyan("\n   🔥 Running pipeline sequentially...\n"));
        console.log(chalk.white.bold("   📋 Open a new tab and jump in:\n"));
        for (const { ticketId, path } of spawnedPaths) {
          const cwd = process.cwd();
          const relativePath = relative(cwd, path) || path;
          console.log(
            chalk.yellow(`   cd ${relativePath}`) +
              chalk.gray(`  # ${ticketId}`),
          );
        }
        console.log("");
      } else if (mode === "terminals") {
        console.log(chalk.cyan("\n   ⚡ Opening terminal tabs...\n"));
        const { execSync } = await import("child_process");
        for (const { ticketId, path } of spawnedPaths) {
          try {
            // macOS: open new Terminal tab with cd
            execSync(
              `osascript -e 'tell application "Terminal" to do script "cd ${path} && echo \\"🔥 ${ticketId} ready\\" && pwd"'`,
              { timeout: 5000 },
            );
            console.log(chalk.green(`   ✅ ${ticketId} → new terminal tab`));
          } catch {
            console.log(
              chalk.yellow(
                `   ⚠️  Could not open tab for ${ticketId}, use: cd ${path}`,
              ),
            );
          }
        }
        console.log("");
      } else if (mode === "agent-manager") {
        console.log(chalk.cyan("\n   🚀 Launching Antigravity IDE...\n"));
        const { execSync } = await import("child_process");

        // Antigravity CLI binary path inside the macOS app bundle
        const antigravityCli =
          "/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity";

        for (const { ticketId, path } of spawnedPaths) {
          try {
            // Try the CLI binary first (works if shell command is installed)
            try {
              execSync(`"${antigravityCli}" "${path}"`, { timeout: 5000 });
            } catch {
              // Fallback: use macOS open command
              execSync(`open -a Antigravity "${path}"`, { timeout: 5000 });
            }
            console.log(
              chalk.green(`   ✅ ${ticketId} → Antigravity window opened`),
            );
          } catch {
            console.log(
              chalk.yellow(
                `   ⚠️  Could not open Antigravity for ${ticketId}. Open manually: cd ${path}`,
              ),
            );
          }
        }
        console.log(
          chalk.white.bold(
            "\n   🤖 Agent Manager: switch to Agent Manager view in each window to start AI conversations\n",
          ),
        );
      }
    }
  });

/**
 * Fetch a single ticket from Jira MCP.
 */
async function fetchSingleTicket(
  ticketId: string,
  targetRepo: string,
  sourceBranch: string,
  config: FlareConfig,
): Promise<Ticket[]> {
  const source = resolveTicketSource(
    config,
    targetRepo,
    sourceBranch,
  ) as JiraMcpSource;
  const ticket = await source.fetchIssue(ticketId);
  if (!ticket) {
    throw new Error(
      `❌ Could not fetch ticket ${ticketId} from Jira MCP.\n   Check your jira.cloudId and MCP server configuration.`,
    );
  }
  console.log(chalk.green(`✅ Fetched ticket from Jira MCP: ${ticket.id}`));
  return [ticket];
}
