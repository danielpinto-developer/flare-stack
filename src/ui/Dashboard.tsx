/**
 * FLARE STACK — Ink TUI Dashboard
 *
 * React-for-terminal live dashboard showing active worktrees,
 * their status, model config, and recent activity.
 *
 * Uses Ink (React renderer for CLI) for a rich terminal UI.
 */

import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";
import { listWorktrees } from "../core/worktree-manager.js";
import { listContexts } from "../core/holodeck.js";
import { selectModel, type WorkflowPhase } from "../core/model-router.js";

interface WorktreeInfo {
  path: string;
  branch: string;
  repo: string;
}

interface DashboardProps {
  config: FlareConfig;
  worktrees: WorktreeInfo[];
  showModels: boolean;
}

const Header: React.FC = () => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color="cyan">
      ╔══════════════════════════════════════════════════════╗
    </Text>
    <Text bold color="cyan">
      ║ 🚀 FLARE STACK — Parallel Reality Dashboard ║
    </Text>
    <Text bold color="cyan">
      ╚══════════════════════════════════════════════════════╝
    </Text>
  </Box>
);

const WorktreeRow: React.FC<{ wt: WorktreeInfo; index: number }> = ({
  wt,
  index,
}) => {
  const ticketMatch = wt.branch.match(/([A-Z]+-\d+)/);
  const ticket = ticketMatch ? ticketMatch[1] : wt.branch;

  return (
    <Box>
      <Box width={4}>
        <Text color="gray">{String(index + 1).padStart(2, " ")}.</Text>
      </Box>
      <Box width={16}>
        <Text bold color="cyan">
          {ticket}
        </Text>
      </Box>
      <Box width={20}>
        <Text color="yellow">{wt.repo}</Text>
      </Box>
      <Box width={40}>
        <Text color="gray">{wt.branch}</Text>
      </Box>
    </Box>
  );
};

const ModelTable: React.FC<{ config: FlareConfig }> = ({ config }) => {
  const phases: WorkflowPhase[] = [
    "planning",
    "verification",
    "implementation",
    "audit",
  ];

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="white">
        📊 Model Configuration
      </Text>
      <Box marginTop={1}>
        <Box width={18}>
          <Text bold color="gray">
            PHASE
          </Text>
        </Box>
        <Box width={15}>
          <Text bold color="gray">
            PROVIDER
          </Text>
        </Box>
        <Box width={28}>
          <Text bold color="gray">
            MODEL
          </Text>
        </Box>
        <Box width={8}>
          <Text bold color="gray">
            TIER
          </Text>
        </Box>
        <Box width={6}>
          <Text bold color="gray">
            TEMP
          </Text>
        </Box>
      </Box>
      <Text color="gray">{"─".repeat(75)}</Text>
      {phases.map((phase) => {
        const model = selectModel(phase, config);
        return (
          <Box key={phase}>
            <Box width={18}>
              <Text color="white">{phase}</Text>
            </Box>
            <Box width={15}>
              <Text color="green">{model.provider}</Text>
            </Box>
            <Box width={28}>
              <Text color="cyan">{model.model}</Text>
            </Box>
            <Box width={8}>
              <Text color="yellow">{model.tier}</Text>
            </Box>
            <Box width={6}>
              <Text color="gray">{model.temperature}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

const Dashboard: React.FC<DashboardProps> = ({
  config,
  worktrees,
  showModels,
}) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      <Box marginBottom={1}>
        <Text color="gray">
          Project: <Text color="white">{config.project}</Text> │ Time:{" "}
          <Text color="white">{time}</Text> │ Worktrees:{" "}
          <Text color="green">{worktrees.length}</Text>
        </Text>
      </Box>

      {worktrees.length === 0 ? (
        <Box>
          <Text color="yellow">
            ⚠️ No active worktrees. Run `flare ignite` to create some.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text bold color="white">
            🌌 Active Realities
          </Text>
          <Box marginTop={1}>
            <Box width={4}>
              <Text bold color="gray">
                {"  #"}
              </Text>
            </Box>
            <Box width={16}>
              <Text bold color="gray">
                TICKET
              </Text>
            </Box>
            <Box width={20}>
              <Text bold color="gray">
                REPO
              </Text>
            </Box>
            <Box width={40}>
              <Text bold color="gray">
                BRANCH
              </Text>
            </Box>
          </Box>
          <Text color="gray">{"─".repeat(75)}</Text>
          {worktrees.map((wt, i) => (
            <WorktreeRow key={wt.path} wt={wt} index={i} />
          ))}
        </Box>
      )}

      {showModels && <ModelTable config={config} />}

      <Box marginTop={1}>
        <Text color="gray" italic>
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Launch the Ink TUI Dashboard.
 */
export async function launchDashboard(
  config: FlareConfig,
  showModels: boolean = false,
): Promise<void> {
  const worktrees = await listWorktrees(config);

  const { waitUntilExit } = render(
    React.createElement(Dashboard, { config, worktrees, showModels }),
  );

  await waitUntilExit();
}

/**
 * Fallback: chalk-based status table (for non-interactive terminals).
 */
export function printChalkStatus(
  config: FlareConfig,
  worktrees: Array<{ path: string; branch: string; repo: string }>,
  showModels: boolean,
): void {
  console.log(chalk.cyan.bold("\n🚀 FLARE STACK — Status\n"));
  console.log(chalk.gray(`   Project: ${config.project}`));
  console.log(chalk.gray(`   Workspaces: ${config.workspacesDir}\n`));

  if (worktrees.length === 0) {
    console.log(
      chalk.yellow("   ⚠️  No active worktrees. Run `flare ignite` first.\n"),
    );
    return;
  }

  console.log(
    chalk.gray("   ") +
      chalk.bold.white("TICKET".padEnd(16)) +
      chalk.bold.white("REPO".padEnd(20)) +
      chalk.bold.white("BRANCH"),
  );
  console.log(chalk.gray("   " + "─".repeat(70)));

  for (const wt of worktrees) {
    const ticketMatch = wt.branch.match(/([A-Z]+-\d+)/);
    const ticket = ticketMatch ? ticketMatch[1] : "-";

    console.log(
      chalk.gray("   ") +
        chalk.cyan(ticket.padEnd(16)) +
        chalk.yellow(wt.repo.padEnd(20)) +
        chalk.gray(wt.branch),
    );
  }

  if (showModels) {
    const phases: WorkflowPhase[] = [
      "planning",
      "verification",
      "implementation",
      "audit",
    ];
    console.log(chalk.white.bold("\n   📊 Model Configuration\n"));
    for (const phase of phases) {
      const model = selectModel(phase, config);
      console.log(
        chalk.gray("   ") +
          chalk.white(phase.padEnd(18)) +
          chalk.green(model.provider.padEnd(12)) +
          chalk.cyan(model.model),
      );
    }
  }

  console.log("");
}
