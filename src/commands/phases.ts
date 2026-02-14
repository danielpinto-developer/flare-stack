/**
 * FLARE STACK — Individual Phase Commands
 *
 * `flare plan [ticketId]` — Run only the Planning phase
 * `flare verify [ticketId]` — Run only the Verification phase
 * `flare implement [ticketId]` — Run only the Implementation phase
 * `flare audit [ticketId]` — Run only the Audit phase
 *
 * Auto-detects ticket from CWD when inside a worktree.
 * Tracks state in .flare-state.json per worktree.
 * On failure: asks the user (retry/stop). No silent fallbacks.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  selectModel,
  logModelSelection,
  type WorkflowPhase,
} from "../core/model-router.js";
import { executePrompt, logAIResponse } from "../core/ai-executor.js";
import { listWorktrees } from "../core/worktree-manager.js";
import {
  markPhaseStarted,
  markPhaseCompleted,
  loadPipelineState,
  savePipelineState,
} from "../core/pipeline-state.js";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const PHASE_META: Record<
  WorkflowPhase,
  { emoji: string; promptFile: string; description: string }
> = {
  planning: {
    emoji: "📋",
    promptFile: "1_PLAN.md",
    description: "Create an implementation plan from ticket requirements",
  },
  verification: {
    emoji: "🔍",
    promptFile: "2_VERIFY.md",
    description: "Verify the plan against codebase patterns and standards",
  },
  implementation: {
    emoji: "🔥",
    promptFile: "3_IMPLEMENT.md",
    description: "Write production code following the verified plan",
  },
  scanning: {
    emoji: "🔎",
    promptFile: "5_SCAN.md",
    description: "Scavenger Bot — blast radius scan for collateral damage",
  },
  audit: {
    emoji: "🛡️",
    promptFile: "4_AUDIT.md",
    description: "Final code review and greenlight/reject decision",
  },
  forging: {
    emoji: "🔨",
    promptFile: "5_FORGE.md",
    description: "Iteratively refine frontend UI against design specs",
  },
};

function createPhaseCommand(phase: WorkflowPhase): Command {
  const meta = PHASE_META[phase];

  return new Command(
    phase === "planning"
      ? "plan"
      : phase === "verification"
        ? "verify"
        : phase === "implementation"
          ? "implement"
          : phase === "scanning"
            ? "scan"
            : "audit",
  )
    .description(`${meta.emoji} ${meta.description}`)
    .argument("[ticketId]", "Ticket ID (auto-detects from CWD)")
    .option("-r, --repo <repo>", "Target repo")
    .option("--show-prompt", "Output the full prompt content")
    .action(async (ticketId: string | undefined, options) => {
      const config = await loadConfig();

      console.log(
        chalk.cyan.bold(
          `\n${meta.emoji} FLARE STACK — Phase: ${phase.toUpperCase()}\n`,
        ),
      );

      // --- Auto-detect or pick ticket ---
      let resolvedTicketId = ticketId;

      if (!resolvedTicketId) {
        // Try to detect from CWD (are we inside a worktree?)
        const cwd = process.cwd();
        if (cwd.startsWith(config.workspacesDir)) {
          const relative = cwd.slice(config.workspacesDir.length + 1);
          const parts = relative.split("/");
          if (parts[0]) {
            resolvedTicketId = parts[0];
            console.log(
              chalk.gray(
                `   Auto-detected ticket from CWD: ${resolvedTicketId}`,
              ),
            );
          }
        }
      }

      if (!resolvedTicketId) {
        // Interactive picker
        const worktrees = await listWorktrees(config);
        const active = worktrees.filter(
          (wt) => wt.path !== config.repos[wt.repo]?.path,
        );

        if (active.length === 0) {
          console.log(
            chalk.yellow(
              "   No active worktrees found. Run `flare ignite` first.\n",
            ),
          );
          process.exit(1);
        }

        const { select } = await import("@inquirer/prompts");
        resolvedTicketId = await select({
          message: `Pick a ticket for ${phase}:`,
          choices: active.map((wt) => {
            const ticket = wt.branch.replace(/^feat\//, "");
            return {
              name: `${ticket}  ${chalk.gray(`(${wt.repo} → ${wt.branch})`)}`,
              value: ticket,
            };
          }),
        });
      }

      console.log(chalk.white(`   Ticket: ${resolvedTicketId}`));

      // Resolve worktree
      const worktreePath = join(config.workspacesDir, resolvedTicketId!);

      if (!existsSync(worktreePath)) {
        console.error(chalk.red(`\n❌ Worktree not found: ${worktreePath}`));
        console.error(chalk.yellow("   Run `flare ignite` first.\n"));
        process.exit(1);
      }

      // Validate prompt file
      const promptPath = join(worktreePath, meta.promptFile);
      if (!existsSync(promptPath)) {
        console.error(chalk.red(`\n❌ Missing prompt: ${meta.promptFile}`));
        console.error(
          chalk.yellow("   Run `flare ignite` to inject prompts.\n"),
        );
        process.exit(1);
      }

      // Show model for this phase
      const model = selectModel(phase, config);
      console.log("");
      logModelSelection(phase, model);

      // Check current state
      const state = await loadPipelineState(worktreePath);
      if (state && state.completedPhases.includes(phase)) {
        console.log(
          chalk.gray(`   ℹ️  This phase was already completed previously.`),
        );
      }

      // Read prompt + context
      const promptContent = await readFile(promptPath, "utf-8");

      let context = "";

      // Fetch live ticket details from Jira MCP
      if (config.jira.cloudId && resolvedTicketId) {
        try {
          const { JiraMcpSource } =
            await import("../sources/jira-mcp-source.js");
          const firstRepo = Object.keys(config.repos)[0] || "";
          const firstBranch =
            config.repos[firstRepo]?.branches?.[0] || "develop";
          const source = new JiraMcpSource(
            config.jira.mcpServer,
            config.jira.cloudId,
            config.jira.projectKeys,
            firstRepo,
            firstBranch,
            config.jira.queueStatus,
            config.jira.siteUrl,
          );
          const ticket = await source.fetchIssue(resolvedTicketId);
          if (ticket?.rawContent) {
            console.log(
              chalk.green(`   ✅ Fetched live ticket data from Jira`),
            );
            context += `JIRA TICKET:\n${ticket.rawContent}\n`;
          }
        } catch (err) {
          console.log(
            chalk.yellow(
              `   ⚠️  Could not fetch Jira ticket: ${err instanceof Error ? err.message : err}`,
            ),
          );
        }
      }

      // Inject repo + branch config from flare.config.ts
      context += "\n\nPROJECT CONFIGURATION:\n";
      context += `Ticket: ${resolvedTicketId}\n`;
      context += `Branching Pattern: ${config.branching.pattern}\n`;
      context += `Repositories:\n`;
      for (const [name, repo] of Object.entries(config.repos)) {
        context += `  - ${name}: ${repo.path}\n`;
        context += `    Active branches: ${repo.branches.join(", ")}\n`;
        context += `    Source of truth: ${repo.branches[0]}\n`;
      }

      // Read code review prompt
      const codeReviewPath = join(worktreePath, "CODE_REVIEW_PROMPT.md");
      if (existsSync(codeReviewPath)) {
        const codeReview = await readFile(codeReviewPath, "utf-8");
        context += `\n\nCODE REVIEW STANDARDS:\n${codeReview}`;
      }

      // Read previous phase output if available
      const phaseOrder: WorkflowPhase[] = [
        "planning",
        "verification",
        "implementation",
        "scanning",
        "audit",
      ];
      const prevIndex = phaseOrder.indexOf(phase) - 1;
      if (prevIndex >= 0) {
        const prevPhase = phaseOrder[prevIndex];
        const prevOutputPath = join(
          worktreePath,
          `OUTPUT_${prevPhase.toUpperCase()}.md`,
        );
        if (existsSync(prevOutputPath)) {
          const prevOutput = await readFile(prevOutputPath, "utf-8");
          context += `\n\nPREVIOUS PHASE OUTPUT:\n${prevOutput}`;
        }
      }

      if (options.showPrompt) {
        console.log(chalk.cyan("\n" + "─".repeat(60)));
        console.log(chalk.white.bold("\n   📄 PROMPT CONTENT:\n"));
        console.log(chalk.gray(promptContent));
      }

      // EXECUTE AI
      console.log(chalk.cyan("\n" + "═".repeat(60)));
      console.log(
        chalk.white.bold(`\n   🚀 Executing ${phase.toUpperCase()}...\n`),
      );

      // Mark phase as started in state
      await markPhaseStarted(worktreePath, resolvedTicketId!, phase);

      const modelConfig = config.models[phase];

      try {
        const response = await executePrompt(
          promptContent,
          context,
          modelConfig,
        );
        logAIResponse(response);

        // Save output
        const outputPath = join(
          worktreePath,
          `OUTPUT_${phase.toUpperCase()}.md`,
        );
        await writeFile(outputPath, response.content);
        console.log(
          chalk.green(`   💾 Output saved: OUTPUT_${phase.toUpperCase()}.md`),
        );

        // Parse ticket type from plan output (if planning phase)
        if (phase === "planning") {
          const typeMatch = response.content.match(
            /<!--\s*TICKET_TYPE:\s*(frontend|full-stack|backend)\s*-->/i,
          );
          if (typeMatch) {
            let ticketType = typeMatch[1].toLowerCase() as
              | "frontend"
              | "full-stack"
              | "backend";

            // Extract confidence score
            const confMatch = response.content.match(
              /<!--\s*TICKET_CONFIDENCE:\s*(\d+)\s*-->/i,
            );
            const confidence = confMatch ? parseInt(confMatch[1], 10) : null;

            // Extract reasoning
            const reasonMatch = response.content.match(
              /<!--\s*TICKET_REASONING:\s*(.+?)\s*-->/i,
            );
            const reasoning = reasonMatch ? reasonMatch[1].trim() : null;

            const typeEmoji =
              ticketType === "backend"
                ? "⚙️"
                : ticketType === "frontend"
                  ? "🎨"
                  : "🔀";

            // Show classification with confidence and reasoning
            console.log(
              chalk.cyan(
                `   ${typeEmoji} AI classified ticket as: ${ticketType.toUpperCase()}`,
              ),
            );
            if (confidence !== null) {
              const confColor =
                confidence >= 90
                  ? chalk.green
                  : confidence >= 60
                    ? chalk.yellow
                    : chalk.red;
              console.log(confColor(`   📊 Confidence: ${confidence}/100`));
            }
            if (reasoning) {
              console.log(chalk.gray(`   💬 ${reasoning}`));
            }

            // Ask for confirmation
            const { select } = await import("@inquirer/prompts");
            const confirmed = await select({
              message: chalk.yellow(
                `Ticket type: ${ticketType.toUpperCase()} — accept or override?`,
              ),
              choices: [
                {
                  name: `✅ Accept: ${ticketType.toUpperCase()}`,
                  value: ticketType,
                },
                {
                  name: "🎨 Override → FRONTEND (UI-only, needs Figma)",
                  value: "frontend" as const,
                },
                {
                  name: "🔀 Override → FULL-STACK (UI + backend, needs Figma)",
                  value: "full-stack" as const,
                },
                {
                  name: "⚙️  Override → BACKEND (no UI, skip forge)",
                  value: "backend" as const,
                },
              ],
            });

            if (confirmed !== ticketType) {
              console.log(
                chalk.yellow(
                  `   ✏️  Overridden: ${ticketType.toUpperCase()} → ${confirmed.toUpperCase()}`,
                ),
              );
              ticketType = confirmed;
            }

            const state = await loadPipelineState(worktreePath);
            if (state) {
              state.ticketType = ticketType;
              await savePipelineState(worktreePath, state);
            }

            if (ticketType === "backend") {
              console.log(
                chalk.gray(
                  "   → Forge phase will be auto-skipped (no UI work)",
                ),
              );
            } else {
              console.log(
                chalk.yellow(
                  "   → Forge phase available after implementation (UI refinement)",
                ),
              );
            }
          }
        }

        // Mark phase as completed in state
        await markPhaseCompleted(worktreePath, resolvedTicketId!, phase);

        // Phase-specific verdict detection
        if (phase === "verification") {
          // Parse structured verdict tags
          const verdictMatch = response.content.match(
            /<!--\s*VERIFY_VERDICT:\s*(VERIFIED|REVISE)\s*-->/i,
          );
          const confMatch = response.content.match(
            /<!--\s*VERIFY_CONFIDENCE:\s*(\d+)\s*-->/i,
          );
          const confidence = confMatch ? parseInt(confMatch[1], 10) : null;
          const confDisplay = confidence !== null ? ` (${confidence}/100)` : "";

          if (verdictMatch) {
            const verdict = verdictMatch[1].toUpperCase();
            if (verdict === "VERIFIED") {
              const confColor =
                confidence && confidence >= 90 ? chalk.green : chalk.yellow;
              console.log(
                chalk.green.bold(
                  `\n   ✅ PLAN VERIFIED${confDisplay} — Ready for implementation.`,
                ),
              );
              console.log(
                chalk.cyan("   → Next: flare implement (Gemini 3 Pro HIGH)"),
              );
            } else {
              console.log(
                chalk.yellow.bold(
                  `\n   ⚠️  REVISE${confDisplay} — Plan needs corrections before implementation.`,
                ),
              );
              console.log(
                chalk.yellow(
                  "   → Review OUTPUT_VERIFICATION.md for corrections, then re-run: flare plan",
                ),
              );
            }
          } else if (response.content.toUpperCase().includes("PLAN VERIFIED")) {
            console.log(
              chalk.green.bold(
                "\n   ✅ PLAN VERIFIED — Ready for implementation.",
              ),
            );
          } else if (response.content.toUpperCase().includes("REVISE")) {
            console.log(
              chalk.yellow.bold(
                "\n   ⚠️  REVISE — Plan needs changes before implementation.",
              ),
            );
          }
        } else if (
          phase === "audit" &&
          response.content.toUpperCase().includes("GREENLIGHT")
        ) {
          console.log(chalk.green.bold("\n   🟢 GREENLIGHT — Ready for push!"));
        } else if (
          phase === "audit" &&
          response.content.toUpperCase().includes("REJECT")
        ) {
          console.log(
            chalk.red.bold("\n   🔴 REJECTED — Issues found. Fix and re-run."),
          );
        }

        console.log(chalk.cyan("\n" + "═".repeat(60)));
        console.log(
          chalk.green.bold(`\n   ✅ ${phase.toUpperCase()} COMPLETE\n`),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          chalk.red(`\n   ❌ ${phase.toUpperCase()} FAILED: ${message}`),
        );

        // No silent fallback — ask the user what to do
        const { select } = await import("@inquirer/prompts");
        const action = await select({
          message: `Phase ${phase} failed. What do you want to do?`,
          choices: [
            { name: "🔄 Retry this phase", value: "retry" },
            { name: "🛑 Stop", value: "stop" },
          ],
        });

        if (action === "retry") {
          console.log(
            chalk.yellow(
              `\n   🔄 Re-run: flare ${phase === "planning" ? "plan" : phase === "verification" ? "verify" : phase === "implementation" ? "implement" : phase === "scanning" ? "scan" : "audit"} ${resolvedTicketId}\n`,
            ),
          );
          return;
        }

        process.exit(1);
      }
    });
}

export const planCommand = createPhaseCommand("planning");
export const verifyCommand = createPhaseCommand("verification");
export const implementCommand = createPhaseCommand("implementation");
// scanning phase is handled by scan.ts (standalone Scavenger Bot command)
export const auditCommand = createPhaseCommand("audit");
