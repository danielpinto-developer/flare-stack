/**
 * FLARE STACK — Greenlight Command
 *
 * `flare greenlight <ticketId>` — Final human approval gate.
 *
 * This is the last step AFTER `flare burn` has completed.
 * The user reviews all outputs, feels confident, and gives the greenlight to push.
 *
 * Shows: classification, plan summary, audit verdict, scope guard result.
 * Then: creates a commit and pushes to origin.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { listWorktrees } from "../core/worktree-manager.js";
import {
  loadPipelineState,
  isPipelineComplete,
} from "../core/pipeline-state.js";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, relative } from "path";
import { execFileSync } from "child_process";

export const greenlightCommand = new Command("greenlight")
  .description("🟢 Final approval — review outputs and push to GitHub")
  .argument("[ticketId]", "Ticket ID to greenlight (auto-detects from CWD)")
  .option("--force", "Push even if pipeline is incomplete")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(
      chalk.green.bold("\n🟢 FLARE STACK — Greenlight (Final Approval)\n"),
    );

    // --- Auto-detect or pick ticket ---
    let resolvedTicketId = ticketId;

    // --- Auto-detect from CWD ---
    if (!resolvedTicketId) {
      const cwd = process.cwd();
      if (cwd.includes(config.workspacesDir)) {
        const rel = relative(config.workspacesDir, cwd);
        const parts = rel.split("/");
        if (parts[0]) {
          resolvedTicketId = parts[0];
          console.log(
            chalk.gray(`   Auto-detected ticket from CWD: ${resolvedTicketId}`),
          );
        }
      }
    }

    if (!resolvedTicketId) {
      const worktrees = await listWorktrees(config);
      const activeWorktrees = worktrees.filter(
        (wt) => wt.path !== config.repos[wt.repo]?.path,
      );

      if (activeWorktrees.length === 0) {
        console.error(
          chalk.red("   ❌ No active worktrees. Run `flare ignite` first.\n"),
        );
        process.exit(1);
      }

      if (activeWorktrees.length === 1) {
        resolvedTicketId = activeWorktrees[0].branch;
      } else {
        const { select } = await import("@inquirer/prompts");
        resolvedTicketId = await select({
          message: "Which ticket to greenlight?",
          choices: activeWorktrees.map((wt) => ({
            name: `${wt.repo} → ${wt.branch}`,
            value: wt.branch,
          })),
        });
      }
    }

    // Resolve the worktree path
    const worktreePath = join(config.workspacesDir, resolvedTicketId!);

    if (!existsSync(worktreePath)) {
      console.error(chalk.red(`\n❌ Worktree not found: ${worktreePath}`));
      console.error(chalk.yellow("   Run `flare ignite` first.\n"));
      process.exit(1);
    }

    // Check pipeline state
    const state = await loadPipelineState(worktreePath);

    if (!isPipelineComplete(state) && !options.force) {
      console.log(chalk.yellow("   ⚠️  Combustion cycle is NOT complete.\n"));
      if (state && state.completedPhases.length > 0) {
        console.log(
          chalk.gray(`   Completed: ${state.completedPhases.join(" → ")}`),
        );
      } else {
        console.log(chalk.gray("   No phases completed."));
      }
      console.log(
        chalk.yellow("\n   Run `flare burn` to complete the cycle first."),
      );
      console.log(chalk.gray("   Or use `--force` to push anyway.\n"));
      return;
    }

    // ═══ DISPLAY SUMMARY ═══════════════════════════════════════
    console.log(chalk.cyan("═".repeat(60)));
    console.log(chalk.white.bold("   📋 Pipeline Summary\n"));

    // Show completed phases
    if (state) {
      console.log(
        chalk.green(`   ✅ Phases: ${state.completedPhases.join(" → ")}`),
      );
      if (state.ticketType) {
        console.log(chalk.gray(`   🎫 Type: ${state.ticketType}`));
      }
    }

    // Show plan summary (first 10 lines)
    const planFile = join(worktreePath, "OUTPUT_PLANNING.md");
    if (existsSync(planFile)) {
      const plan = await readFile(planFile, "utf-8");
      const planPreview = plan.split("\n").slice(0, 10).join("\n");
      console.log(chalk.gray("\n   📋 Plan (preview):"));
      console.log(chalk.gray(`   ${planPreview.replace(/\n/g, "\n   ")}`));
    }

    // Show audit verdict
    const auditFile = join(worktreePath, "OUTPUT_AUDIT.md");
    if (existsSync(auditFile)) {
      const audit = await readFile(auditFile, "utf-8");
      const hasGreenlight = audit.toUpperCase().includes("GREENLIGHT");
      const hasReject = audit.toUpperCase().includes("REJECT");

      if (hasGreenlight) {
        console.log(chalk.green.bold("\n   🟢 Audit Verdict: GREENLIGHT"));
      } else if (hasReject) {
        console.log(chalk.red.bold("\n   🛑 Audit Verdict: REJECT"));
      } else {
        console.log(chalk.yellow("\n   ❓ Audit Verdict: Unclear"));
      }
    }

    console.log(chalk.cyan("\n" + "═".repeat(60)));

    // Show diff preview
    try {
      const diff = execFileSync("git", ["diff", "--stat"], {
        cwd: worktreePath,
        encoding: "utf-8",
      });
      if (diff.trim()) {
        console.log(chalk.white.bold("\n   📊 Uncommitted changes:"));
        console.log(chalk.gray(`   ${diff.replace(/\n/g, "\n   ")}`));
      } else {
        console.log(chalk.gray("\n   No uncommitted changes in worktree."));
      }
    } catch {
      // Not a git repo or other error — skip
    }

    // ═══ HUMAN DECISION ════════════════════════════════════════
    console.log("");
    const { select } = await import("@inquirer/prompts");
    const action = await select({
      message: "🟢 Your call. What do you want to do?",
      choices: [
        {
          name: "🟢 GREENLIGHT — Commit and push to origin",
          value: "push",
        },
        {
          name: "👀 View full audit output first",
          value: "view-audit",
        },
        {
          name: "🛑 Not yet — I need to review more",
          value: "stop",
        },
      ],
    });

    if (action === "view-audit") {
      if (existsSync(auditFile)) {
        const audit = await readFile(auditFile, "utf-8");
        console.log(chalk.cyan("\n" + "═".repeat(60)));
        console.log(chalk.white.bold("   Full Audit Output:\n"));
        console.log(audit);
        console.log(chalk.cyan("═".repeat(60)));

        // Ask again after viewing
        const { confirm } = await import("@inquirer/prompts");
        const finalApproval = await confirm({
          message: "🟢 Give the greenlight? Commit and push?",
          default: false,
        });
        if (!finalApproval) {
          console.log(
            chalk.yellow("\n   ⏸️  No greenlight yet. Take your time.\n"),
          );
          return;
        }
      } else {
        console.log(chalk.yellow("   No audit output found."));
        return;
      }
    } else if (action === "stop") {
      console.log(
        chalk.yellow("\n   ⏸️  No greenlight yet. Take your time.\n"),
      );
      return;
    }

    // ═══ COMMIT & PUSH ═════════════════════════════════════════
    console.log(chalk.cyan("\n" + "═".repeat(60)));
    console.log(chalk.green.bold("   🚀 Pushing to origin...\n"));
    try {
      // Stage only ticket-relevant changes (exclude pipeline artifacts)
      // First, get list of all changed files
      const allChanges = execFileSync(
        "git",
        ["status", "--porcelain", "-uall"],
        { cwd: worktreePath, encoding: "utf-8" },
      )
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.slice(3)); // Remove status prefix (e.g., " M ", "?? ")

      // Exclude pipeline artifacts — these are Flare infrastructure, not ticket code
      const excludePatterns = [
        /^OUTPUT_.*\.md$/,
        /^[0-9]_[A-Z]+\.md$/, // 1_PLAN.md, 2_VERIFY.md, etc.
        /^TICKET\.md$/,
        /^INNO_CODE_REVIEW_PROMPT\.md$/,
        /^\.flare-pipeline\.json$/,
        /^\.agent\//,
        /^images\//,
      ];

      const ticketFiles = allChanges.filter(
        (file) => !excludePatterns.some((pattern) => pattern.test(file)),
      );

      if (ticketFiles.length === 0) {
        console.log(
          chalk.yellow(
            "\n   ⚠️  No ticket-relevant file changes found (only pipeline artifacts).",
          ),
        );
        console.log(
          chalk.yellow(
            "   Did the implementation phase create any code files?\n",
          ),
        );
        return;
      }

      // Show what will be committed
      console.log(chalk.white.bold("   📂 Files to commit:"));
      for (const file of ticketFiles) {
        console.log(chalk.green(`      + ${file}`));
      }
      console.log(
        chalk.gray(
          `\n   (${allChanges.length - ticketFiles.length} pipeline artifacts excluded)`,
        ),
      );

      // Stage only ticket files
      execFileSync("git", ["add", ...ticketFiles], {
        cwd: worktreePath,
        stdio: "pipe",
      });

      // Commit (commitlint-compliant: type(scope): subject — scope must be lowercase)
      const scope = resolvedTicketId!.toLowerCase();
      const commitMessage = `feat(${scope}): implementation via flare stack ai\n\nPipeline: ${state?.completedPhases.join(" → ") || "manual"}`;
      execFileSync("git", ["commit", "-m", commitMessage, "--allow-empty"], {
        cwd: worktreePath,
        stdio: "pipe",
      });

      // Push (array form — branch name cannot inject commands)
      const branchName = resolvedTicketId!;
      execFileSync("git", ["push", "origin", branchName], {
        cwd: worktreePath,
        stdio: "inherit",
      });

      console.log(
        chalk.green.bold("\n   🟢 GREENLIGHT GIVEN. PUSHED TO ORIGIN."),
      );
      console.log(chalk.gray(`   Branch: ${branchName}`));
      console.log(chalk.gray(`   Worktree: ${worktreePath}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n   ❌ Push failed: ${message}`));
      console.error(
        chalk.yellow("   Fix the issue and run `flare greenlight` again.\n"),
      );
    }
  });
