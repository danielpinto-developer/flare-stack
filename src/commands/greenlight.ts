/**
 * FLARE STACK — Burn Command
 *
 * `flare burn <ticketId>` — Run the full AI combustion cycle.
 *
 * Pipeline: Classify → Plan → Judge (loop max 2x) → Implement → Scope Guard → Audit
 * Each phase uses the appropriate model tier from the config.
 *
 * Specialized agents:
 *   - Ticket Classifier: frontend/backend/full-stack classification
 *   - Plan Judge: quality gate with re-plan loop (criticisms fed back)
 *   - Scope Guard: post-implementation drift detection
 *
 * STATE-AWARE: Remembers completed phases in .flare-state.json.
 * Resumes from wherever it left off. No silent fallbacks — asks the user.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  selectModel,
  logModelSelection,
  type WorkflowPhase,
} from "../core/model-router.js";
import {
  executePrompt,
  logAIResponse,
  type AIResponse,
} from "../core/ai-executor.js";
import { listWorktrees } from "../core/worktree-manager.js";
import {
  loadPipelineState,
  savePipelineState,
  markPhaseStarted,
  markPhaseCompleted,
  getNextPhase,
  getRemainingPhases,
  isPipelineComplete,
} from "../core/pipeline-state.js";
import { classifyTicket } from "../core/ticket-classifier.js";
import {
  judgePlan,
  buildRePlanContext,
  QUALITY_THRESHOLD,
  MAX_REPLANS,
} from "../core/plan-judge.js";
import { checkScope } from "../core/scope-guard.js";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export const burnCommand = new Command("burn")
  .description(
    "🔥 Run the AI combustion cycle: Classify → Plan → Judge → Implement → Scope Guard → Audit",
  )
  .argument("[ticketId]", "Ticket ID to process (auto-detects from CWD)")
  .option("-r, --repo <repo>", "Target repo")
  .option("--dry-run", "Show what would happen without executing")
  .option("--restart", "Restart the pipeline from scratch (clear state)")
  .option("--no-pause", "Skip human checkpoints between phases")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(
      chalk.cyan.bold("\n🔥 FLARE STACK — Burn (AI Combustion Cycle)\n"),
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
            chalk.gray(`   Auto-detected ticket from CWD: ${resolvedTicketId}`),
          );
        }
      }
    }

    if (!resolvedTicketId) {
      // Interactive picker: show active worktrees
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
        message: "Pick a ticket to burn:",
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

    // Resolve the worktree path
    const worktreePath = join(config.workspacesDir, resolvedTicketId!);

    if (!existsSync(worktreePath)) {
      console.error(chalk.red(`\n❌ Worktree not found: ${worktreePath}`));
      console.error(chalk.yellow("   Run `flare ignite` first.\n"));
      process.exit(1);
    }

    // Verify prompt files exist
    const requiredFiles = [
      "1_PLAN.md",
      "2_VERIFY.md",
      "3_IMPLEMENT.md",
      "4_AUDIT.md",
    ];
    const missing = requiredFiles.filter(
      (f) => !existsSync(join(worktreePath, f)),
    );

    if (missing.length > 0) {
      console.error(chalk.red(`\n❌ Missing files in worktree:`));
      for (const f of missing) {
        console.error(chalk.yellow(`   - ${f}`));
      }
      console.error(
        chalk.yellow("\n   Run `flare ignite` to inject prompts.\n"),
      );
      process.exit(1);
    }

    // --- Load pipeline state ---
    let state = await loadPipelineState(worktreePath);

    if (options.restart && state) {
      console.log(chalk.yellow("   🔄 Restarting pipeline from scratch...\n"));
      state = null;
    }

    // Check if already complete
    if (isPipelineComplete(state)) {
      console.log(chalk.green.bold("   ✅ Combustion cycle already complete!"));
      console.log(
        chalk.gray(`   Completed: ${state!.completedPhases.join(" → ")}\n`),
      );
      console.log(
        chalk.cyan("   Run `flare greenlight` to review and push.\n"),
      );
      const { confirm } = await import("@inquirer/prompts");
      const restart = await confirm({
        message: "Run the pipeline again from the start?",
        default: false,
      });

      if (!restart) {
        console.log(chalk.gray("   Done.\n"));
        return;
      }

      state = null;
    }

    // Determine remaining phases
    const remaining = getRemainingPhases(state);

    if (state && state.completedPhases.length > 0) {
      console.log(
        chalk.green(
          `   ✅ Already completed: ${state.completedPhases.join(" → ")}`,
        ),
      );
      console.log(
        chalk.cyan(`   🔥 Resuming from: ${remaining[0].toUpperCase()}\n`),
      );
    }

    // Show pipeline
    console.log(chalk.gray("   Pipeline:"));
    for (const phase of remaining) {
      const model = selectModel(phase, config);
      logModelSelection(phase, model);
    }

    if (options.dryRun) {
      console.log(
        chalk.yellow("\n   🏁 Dry run complete. No actions taken.\n"),
      );
      return;
    }

    // Read the Jira ticket context (used for all phases)
    const ticketFile = join(worktreePath, "TICKET.md");
    let ticketContent: string;
    if (existsSync(ticketFile)) {
      ticketContent = await readFile(ticketFile, "utf-8");
    } else {
      console.log(
        chalk.yellow.bold("\n   ⚠️  WARNING: TICKET.md not found in worktree!"),
      );
      console.log(
        chalk.yellow(
          "   The pipeline will run with minimal context. All agents will have",
        ),
      );
      console.log(
        chalk.yellow("   almost no information about the ticket requirements."),
      );
      const { confirm: proceedAnyway } = await import("@inquirer/prompts");
      const goAhead = await proceedAnyway({
        message: "Continue without TICKET.md?",
        default: false,
      });
      if (!goAhead) {
        console.log(
          chalk.gray(
            "\n   Run `flare ignite` to re-create the worktree with TICKET.md.\n",
          ),
        );
        return;
      }
      ticketContent = `Ticket: ${resolvedTicketId}`;
    }

    // Read code review prompt if available
    let codeReviewContent = "";
    const codeReviewPath = join(worktreePath, "CODE_REVIEW_PROMPT.md");
    if (existsSync(codeReviewPath)) {
      codeReviewContent = await readFile(codeReviewPath, "utf-8");
    }

    // ═══ AGENT: TICKET CLASSIFIER ═══════════════════════════════
    // Runs before the phase loop to inform planning
    console.log(chalk.cyan("\n" + "═".repeat(60)));
    console.log(chalk.cyan.bold("\n🎫 AGENT: Ticket Classifier\n"));

    const classification = await classifyTicket(
      resolvedTicketId!,
      ticketContent.split("\n")[0] || "",
      ticketContent,
    );

    const typeEmoji =
      classification.type === "frontend"
        ? "🎨"
        : classification.type === "backend"
          ? "⚙️"
          : "🔗";
    console.log(
      chalk.white(
        `   ${typeEmoji} Type: ${chalk.bold(classification.type.toUpperCase())}`,
      ),
    );
    console.log(
      chalk.gray(
        `   Confidence: ${classification.confidence}% — ${classification.reasoning}`,
      ),
    );
    if (classification.needsFigma) {
      console.log(
        chalk.yellow(
          "   📐 Figma/design reference recommended for this ticket",
        ),
      );
    }

    // Save classification to pipeline state (H1 — avoid re-running on resume)
    if (state) {
      state.classification = classification;
      await savePipelineState(worktreePath, state);
    }

    // Execute each remaining phase with AI
    console.log(chalk.cyan("\n" + "═".repeat(60)));

    const results: Record<string, AIResponse> = {};
    let previousOutput = "";

    // Load previous phase output if resuming
    if (state && state.completedPhases.length > 0) {
      const lastCompleted =
        state.completedPhases[state.completedPhases.length - 1];
      const lastOutputFile = join(
        worktreePath,
        `OUTPUT_${lastCompleted.toUpperCase()}.md`,
      );
      if (existsSync(lastOutputFile)) {
        previousOutput = await readFile(lastOutputFile, "utf-8");
      }
    }

    const phaseMap: Record<WorkflowPhase, string> = {
      planning: "1_PLAN.md",
      verification: "2_VERIFY.md",
      implementation: "3_IMPLEMENT.md",
      audit: "4_AUDIT.md",
      scanning: "5_SCAN.md",
      forging: "5_FORGE.md",
    };

    // Inject classification into context for the planning phase
    let classificationContext = `\nTICKET CLASSIFICATION (pre-determined by Classifier Agent):\n`;
    classificationContext += `Type: ${classification.type}\n`;
    classificationContext += `Confidence: ${classification.confidence}%\n`;
    classificationContext += `Reasoning: ${classification.reasoning}\n`;
    classificationContext += `Needs Figma: ${classification.needsFigma ? "YES" : "NO"}\n`;

    for (const phase of remaining) {
      const modelConfig = config.models[phase];
      const promptFile = join(worktreePath, phaseMap[phase]);
      const promptContent = await readFile(promptFile, "utf-8");

      console.log(chalk.cyan.bold(`\n🔄 PHASE: ${phase.toUpperCase()}`));
      console.log(
        chalk.gray(`   Model: ${selectModel(phase, config).display}`),
      );
      console.log(chalk.gray(`   Prompt: ${phaseMap[phase]}`));

      // Mark phase as started
      await markPhaseStarted(worktreePath, resolvedTicketId!, phase);

      // Build context for this phase
      let context = `JIRA TICKET:\n${ticketContent}`;
      if (codeReviewContent) {
        context += `\n\nCODE REVIEW STANDARDS:\n${codeReviewContent}`;
      }
      if (previousOutput) {
        context += `\n\nPREVIOUS PHASE OUTPUT:\n${previousOutput}`;
      }

      try {
        // Inject classification context into planning phase
        if (phase === "planning") {
          context += classificationContext;
        }

        const response = await executePrompt(
          promptContent,
          context,
          modelConfig,
        );
        logAIResponse(response);
        results[phase] = response;
        previousOutput = response.content;

        // Save phase output to worktree
        const outputFile = join(
          worktreePath,
          `OUTPUT_${phase.toUpperCase()}.md`,
        );
        await writeFile(outputFile, response.content, "utf-8");
        console.log(
          chalk.green(`   📝 Output saved: OUTPUT_${phase.toUpperCase()}.md`),
        );

        // ═══ AGENT: PLAN JUDGE (after planning) ══════════════════
        if (phase === "planning") {
          console.log(chalk.cyan("\n" + "─".repeat(60)));
          console.log(chalk.cyan.bold("\n🔍 AGENT: Plan Judge\n"));

          let planOutput = response.content;
          let verdict = await judgePlan(
            planOutput,
            ticketContent,
            codeReviewContent || undefined,
          );

          const scoreColor =
            verdict.score >= QUALITY_THRESHOLD ? chalk.green : chalk.red;
          console.log(
            chalk.white(
              `   Score: ${scoreColor(`${verdict.score}/100`)} — ${verdict.verdict}`,
            ),
          );
          console.log(chalk.gray(`   ${verdict.summary}`));

          // Re-plan loop: feed criticisms back
          let attempt = 0;
          while (verdict.verdict === "FAIL" && attempt < MAX_REPLANS) {
            attempt++;
            console.log(
              chalk.yellow(
                `\n   ⚠️  Plan scored ${verdict.score}/100 — below ${QUALITY_THRESHOLD} threshold`,
              ),
            );
            console.log(
              chalk.yellow(
                `   🔄 Re-planning (attempt ${attempt}/${MAX_REPLANS})...`,
              ),
            );

            // Show criticisms
            for (const c of verdict.criticisms) {
              console.log(chalk.red(`      ❌ ${c}`));
            }

            // Build re-plan context with criticisms injected
            const rePlanContext = buildRePlanContext(
              planOutput,
              verdict,
              attempt,
            );

            // Re-run planning with the Judge's criticisms
            const rePlanResponse = await executePrompt(
              promptContent,
              context + "\n\n" + rePlanContext,
              modelConfig,
            );
            logAIResponse(rePlanResponse);
            planOutput = rePlanResponse.content;

            // Save updated plan
            await writeFile(outputFile, planOutput, "utf-8");
            results[phase] = rePlanResponse;
            previousOutput = planOutput;

            // Re-judge
            console.log(chalk.cyan("\n" + "─".repeat(40)));
            console.log(chalk.cyan.bold("   🔍 Re-judging...\n"));
            verdict = await judgePlan(
              planOutput,
              ticketContent,
              codeReviewContent || undefined,
            );

            const reScoreColor =
              verdict.score >= QUALITY_THRESHOLD ? chalk.green : chalk.red;
            console.log(
              chalk.white(
                `   Score: ${reScoreColor(`${verdict.score}/100`)} — ${verdict.verdict}`,
              ),
            );
            console.log(chalk.gray(`   ${verdict.summary}`));
          }

          if (verdict.verdict === "FAIL") {
            console.log(
              chalk.red.bold(
                `\n   🛑 Plan failed Judge after ${MAX_REPLANS} re-plans (score: ${verdict.score}/100)`,
              ),
            );
            const { select: selectAction } = await import("@inquirer/prompts");
            const action = await selectAction({
              message:
                "Plan quality is below threshold. What do you want to do?",
              choices: [
                {
                  name: "⏭️  Continue anyway (use current plan)",
                  value: "continue",
                },
                {
                  name: "🛑 Stop and fix the plan manually",
                  value: "stop",
                },
              ],
            });
            if (action === "stop") {
              console.log(
                chalk.yellow(
                  "\n   🛑 Pipeline paused. Fix the plan and run `flare burn` to resume.\n",
                ),
              );
              return;
            }
          } else {
            console.log(chalk.green.bold("\n   ✅ Plan passed quality gate!"));
          }
        }

        // ═══ AGENT: SCOPE GUARD (after implementation) ══════════
        if (phase === "implementation") {
          console.log(chalk.cyan("\n" + "─".repeat(60)));
          console.log(chalk.cyan.bold("\n🛡️  AGENT: Scope Guard\n"));

          // Load the plan output to compare against
          const planFile = join(worktreePath, "OUTPUT_PLANNING.md");
          const planContent = existsSync(planFile)
            ? await readFile(planFile, "utf-8")
            : "(plan not available)";

          const scopeVerdict = await checkScope(
            ticketContent,
            planContent,
            response.content,
          );

          if (scopeVerdict.inScope) {
            console.log(
              chalk.green(
                `   ✅ In scope (confidence: ${scopeVerdict.confidence}%) — ${scopeVerdict.summary}`,
              ),
            );
          } else {
            console.log(
              chalk.yellow.bold(
                `   ⚠️  SCOPE DRIFT DETECTED (confidence: ${scopeVerdict.confidence}%)`,
              ),
            );
            console.log(chalk.gray(`   ${scopeVerdict.summary}`));
            for (const item of scopeVerdict.driftedItems) {
              console.log(chalk.yellow(`      🔸 ${item}`));
            }

            const { select: selectAction } = await import("@inquirer/prompts");
            const action = await selectAction({
              message: "Scope drift detected. What do you want to do?",
              choices: [
                {
                  name: "⏭️  Continue to audit (accept drift)",
                  value: "continue",
                },
                {
                  name: "🛑 Stop and review implementation",
                  value: "stop",
                },
              ],
            });
            if (action === "stop") {
              console.log(
                chalk.yellow(
                  "\n   🛑 Pipeline paused. Fix the implementation and run `flare burn` to resume.\n",
                ),
              );
              return;
            }
          }
        }

        // Mark phase as completed
        await markPhaseCompleted(worktreePath, resolvedTicketId!, phase);

        // Check for REJECT verdict in audit phase
        if (
          phase === "audit" &&
          response.content.toUpperCase().includes("REJECT")
        ) {
          console.log(
            chalk.red.bold(
              "\n   🛑 AUDIT REJECTED — Review needed before push.",
            ),
          );
        } else if (
          phase === "audit" &&
          response.content.toUpperCase().includes("GREENLIGHT")
        ) {
          console.log(
            chalk.green.bold("\n   🟢 AUDIT PASSED — Ready for greenlight!"),
          );
          console.log(
            chalk.cyan("   Run `flare greenlight` to review and push.\n"),
          );
        }

        // ═══ HUMAN CHECKPOINT ═════════════════════════════════════
        // After each phase, pause for human review (unless --no-pause)
        const phaseIndex = [...remaining].indexOf(phase);
        const isLastPhase = phaseIndex === remaining.length - 1;
        if (options.pause !== false && !isLastPhase) {
          console.log(chalk.cyan("\n" + "─".repeat(60)));
          console.log(
            chalk.white.bold(
              `   ⏸️  Phase ${phase.toUpperCase()} complete. Review the output above.`,
            ),
          );
          const { confirm: continueNext } = await import("@inquirer/prompts");
          const proceed = await continueNext({
            message: `Continue to next phase?`,
            default: true,
          });
          if (!proceed) {
            console.log(
              chalk.yellow(
                "\n   ⏸️  Paused. Run `flare burn` to resume from where you left off.\n",
              ),
            );
            return;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n   ❌ Phase ${phase} failed: ${message}`));

        // No silent fallback — ask the user what to do
        const { select } = await import("@inquirer/prompts");
        const action = await select({
          message: `Phase ${phase} failed. What do you want to do?`,
          choices: [
            {
              name: "🔄 Retry this phase",
              value: "retry",
            },
            {
              name: "🛑 Stop the pipeline (resume later with `flare burn`)",
              value: "stop",
            },
          ],
        });

        if (action === "retry") {
          // Re-run the same phase — push it back to front of remaining
          remaining.unshift(phase);
          continue;
        } else {
          console.log(
            chalk.yellow(
              "\n   🛑 Pipeline paused. Run `flare burn` to resume.\n",
            ),
          );
          return;
        }
      }
    }

    console.log(chalk.cyan("\n" + "═".repeat(60)));

    // Summary
    const allCompleted =
      (state?.completedPhases.length || 0) + Object.keys(results).length;
    if (allCompleted >= 4) {
      console.log(chalk.green.bold("\n🔥 COMBUSTION CYCLE COMPLETE"));
      console.log(chalk.gray("   All phases executed successfully."));
      console.log(chalk.gray(`   Outputs saved in: ${worktreePath}`));

      // Show token usage summary
      let totalTokens = 0;
      let totalDuration = 0;
      for (const [, result] of Object.entries(results)) {
        totalTokens += result.tokensUsed || 0;
        totalDuration += result.duration;
      }
      if (totalTokens > 0) {
        console.log(chalk.gray(`   Total tokens: ${totalTokens}`));
      }
      if (totalDuration > 0) {
        console.log(
          chalk.gray(`   Total time: ${(totalDuration / 1000).toFixed(1)}s`),
        );
      }

      console.log(
        chalk.cyan.bold(
          "\n   ➡️  Next: Run `flare greenlight` to review outputs and push.\n",
        ),
      );
    } else {
      console.log(
        chalk.yellow.bold(
          `\n⚠️  Combustion partially complete (${allCompleted} phases)`,
        ),
      );
      console.log(chalk.gray("   Run `flare burn` to resume.\n"));
    }

    console.log("");
  });
