/**
 * FLARE STACK — Jira MCP Source
 *
 * Connects to Jira via the Model Context Protocol (MCP).
 * Spawns an Atlassian MCP server as a subprocess and communicates
 * via stdio transport to fetch tickets, add comments, and transition issues.
 *
 * This is the primary ticket source for Flare Stack.
 *
 * Requires:
 *   - An Atlassian MCP server command (e.g., npx mcp-remote https://mcp.atlassian.com/v1/sse)
 *   - Valid Atlassian credentials configured for the MCP server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import chalk from "chalk";
import type { Ticket, TicketSource } from "./types.js";

export interface McpServerConfig {
  /** Command to spawn the MCP server (e.g., "npx") */
  command: string;
  /** Arguments for the command (e.g., ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"]) */
  args: string[];
  /** Environment variables to pass to the MCP server */
  env?: Record<string, string>;
}

interface JiraMcpIssue {
  key: string;
  fields: {
    summary?: { value?: string } | string;
    description?: { value?: string } | string;
    status?: { value?: string; name?: string } | string;
    issuetype?: { value?: string } | string;
    priority?: { value?: string } | string;
    assignee?:
      | {
          accountId?: string;
          displayName?: string;
          emailAddress?: string;
        }
      | string;
    sprint?:
      | {
          startDate?: string;
          endDate?: string;
          name?: string;
          state?: string;
        }
      | string;
  };
}

export class JiraMcpSource implements TicketSource {
  name = "jira-mcp";

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(
    private serverConfig: McpServerConfig,
    private cloudId: string,
    private projectKeys: string[],
    private defaultRepo: string,
    private firstBranch: string,
    private queueStatus: string = "Dev Review",
    private siteUrl: string = "",
  ) {}

  /**
   * Connect to the MCP server.
   */
  async connect(): Promise<void> {
    if (this.client) return;

    this.transport = new StdioClientTransport({
      command: this.serverConfig.command,
      args: this.serverConfig.args,
      env: {
        ...process.env,
        ...this.serverConfig.env,
      } as Record<string, string>,
      stderr: "ignore",
    });

    this.client = new Client({
      name: "flare-stack",
      version: "1.0.0",
    });

    await this.client.connect(this.transport);
  }

  /**
   * Pre-flight check: verify MCP connection + Atlassian OAuth.
   * Call this before any Jira operations. Throws with setup instructions on failure.
   */
  async preflight(): Promise<void> {
    try {
      await this.connect();
      // Lightweight call to verify OAuth is valid
      await this.callTool("getAccessibleAtlassianResources", {});
      console.log(chalk.green("   ✅ Jira MCP connection verified"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red.bold("\n   ❌ Jira MCP connection failed.\n"));
      console.error(
        chalk.yellow("   This usually means OAuth is not set up.\n"),
      );
      console.error(chalk.white("   To connect your Atlassian account:\n"));
      console.error(
        chalk.cyan(
          "   1. Run:  npx -y mcp-remote https://mcp.atlassian.com/v1/sse",
        ),
      );
      console.error(chalk.cyan("   2. Complete the browser OAuth login"));
      console.error(chalk.cyan("   3. Try again: flare ignite\n"));
      console.error(chalk.gray(`   Debug: ${msg}\n`));
      throw new Error(
        "Jira MCP not authenticated. See setup instructions above.",
      );
    }
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  /**
   * Call an MCP tool on the connected server.
   */
  private async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error(
        "MCP client not connected. Call connect() before using tools.",
      );
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // MCP tool results come as content array
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c: Record<string, unknown>) => c.type === "text",
      );
      if (textContent && "text" in textContent) {
        try {
          return JSON.parse(textContent.text as string);
        } catch {
          return textContent.text;
        }
      }
    }

    return result;
  }

  /**
   * Build JQL query: queueStatus tickets, assigned to me, in open sprints.
   */
  private buildJql(): string {
    const clauses = [
      `status = "${this.queueStatus}"`,
      "assignee = currentUser()",
      "sprint in openSprints()",
    ];

    return `${clauses.join(" AND ")} ORDER BY priority DESC, created DESC`;
  }

  /**
   * Check if a sprint is current (today falls within its date range).
   */
  private isCurrentSprint(sprint: JiraMcpIssue["fields"]["sprint"]): boolean {
    if (!sprint || typeof sprint === "string") return true; // Can't filter, include it
    if (!sprint.startDate || !sprint.endDate) return true;

    const now = new Date();
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    return now >= start && now <= end;
  }

  /**
   * Build Jira issue URL for terminal display.
   */
  issueUrl(issueKey: string): string {
    return `${this.siteUrl}/browse/${issueKey}`;
  }

  /**
   * Fetch tickets from Jira via MCP (implements TicketSource).
   * Filters to queueStatus + currentUser() + current sprint (by date).
   */
  async parse(): Promise<Ticket[]> {
    console.log(
      chalk.cyan(
        `\n🔍 Fetching "${this.queueStatus}" tickets assigned to you in the current sprint...`,
      ),
    );

    await this.preflight();

    try {
      const jql = this.buildJql();

      const result = (await this.callTool("searchJiraIssuesUsingJql", {
        cloudId: this.cloudId,
        jql,
        maxResults: 50,
        fields: [
          "summary",
          "description",
          "status",
          "issuetype",
          "priority",
          "sprint",
        ],
      })) as { issues?: JiraMcpIssue[] } | unknown;

      const issues = this.extractIssues(result);

      // Client-side sprint date filter (handles 2+ open sprints)
      const currentSprintIssues = issues.filter((issue) =>
        this.isCurrentSprint(issue.fields?.sprint),
      );

      if (issues.length > 0 && currentSprintIssues.length < issues.length) {
        console.log(
          chalk.yellow(
            `   ⚠️  Filtered ${issues.length - currentSprintIssues.length} ticket(s) from previous sprint(s)`,
          ),
        );
      }

      const tickets: Ticket[] = [];

      for (const issue of currentSprintIssues) {
        const summary = this.extractFieldValue(issue.fields?.summary);

        tickets.push({
          id: issue.key,
          targetRepo: this.defaultRepo,
          sourceBranch: this.firstBranch,
          rawContent: this.formatIssueAsText(issue),
          summary: summary || undefined,
        });
      }

      console.log(
        chalk.cyan(`   📋 Found ${tickets.length} ticket(s) ready to ignite`),
      );
      return tickets;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Auto-transition a ticket: Dev Review → Dev Ready → In Progress.
   * Discovers transition IDs dynamically so board config changes don't break it.
   */
  async autoTransitionToInProgress(issueKey: string): Promise<void> {
    await this.connect();

    try {
      // Step 1: Dev Review → Dev Ready
      const step1Transitions = (await this.callTool(
        "getTransitionsForJiraIssue",
        {
          cloudId: this.cloudId,
          issueIdOrKey: issueKey,
        },
      )) as {
        transitions?: { id: string; to: { name: string; id: string } }[];
      };

      const toDevReady = step1Transitions.transitions?.find(
        (t) => t.to.name === "Dev Ready",
      );

      if (!toDevReady) {
        console.log(
          chalk.yellow(
            `   ⚠️  ${issueKey}: No transition to "Dev Ready" found, skipping auto-transition`,
          ),
        );
        return;
      }

      await this.callTool("transitionJiraIssue", {
        cloudId: this.cloudId,
        issueIdOrKey: issueKey,
        transition: { id: toDevReady.id },
      });
      console.log(chalk.green(`   🔄 ${issueKey}: Dev Review → Dev Ready`));

      // Step 2: Dev Ready → In Progress
      const step2Transitions = (await this.callTool(
        "getTransitionsForJiraIssue",
        {
          cloudId: this.cloudId,
          issueIdOrKey: issueKey,
        },
      )) as {
        transitions?: { id: string; to: { name: string; id: string } }[];
      };

      const toInProgress = step2Transitions.transitions?.find(
        (t) => t.to.name === "In Progress",
      );

      if (!toInProgress) {
        console.log(
          chalk.yellow(
            `   ⚠️  ${issueKey}: No transition to "In Progress" found (stuck at Dev Ready)`,
          ),
        );
        return;
      }

      await this.callTool("transitionJiraIssue", {
        cloudId: this.cloudId,
        issueIdOrKey: issueKey,
        transition: { id: toInProgress.id },
      });
      console.log(chalk.green(`   🔄 ${issueKey}: Dev Ready → In Progress`));
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Fetch a single issue by key via MCP.
   */
  async fetchIssue(issueKey: string): Promise<Ticket | null> {
    await this.connect();

    try {
      const result = await this.callTool("getJiraIssue", {
        cloudId: this.cloudId,
        issueIdOrKey: issueKey,
      });

      if (!result) return null;

      const issue = result as JiraMcpIssue;
      const summary = this.extractFieldValue(issue.fields?.summary);
      const assignee = this.getAssigneeDisplayName(issue);

      return {
        id: issue.key,
        targetRepo: this.defaultRepo,
        sourceBranch: this.firstBranch,
        rawContent: this.formatIssueAsText(issue),
        summary: summary || undefined,
        assignee: assignee || undefined,
      };
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Batch-fetch multiple issues over a single MCP connection.
   * Avoids repeated connect/disconnect cycles that can cause SIGINT issues.
   */
  async fetchIssues(issueKeys: string[]): Promise<Ticket[]> {
    await this.connect();
    const tickets: Ticket[] = [];

    try {
      for (const issueKey of issueKeys) {
        try {
          const result = await this.callTool("getJiraIssue", {
            cloudId: this.cloudId,
            issueIdOrKey: issueKey,
          });

          if (!result) continue;

          const issue = result as JiraMcpIssue;
          const summary = this.extractFieldValue(issue.fields?.summary);
          const assignee = this.getAssigneeDisplayName(issue);

          tickets.push({
            id: issue.key,
            targetRepo: this.defaultRepo,
            sourceBranch: this.firstBranch,
            rawContent: this.formatIssueAsText(issue),
            summary: summary || undefined,
            assignee: assignee || undefined,
          });
        } catch {
          /* skip failed individual fetch */
        }
      }
    } finally {
      await this.disconnect();
    }

    return tickets;
  }

  /**
   * Extract assignee display name from a Jira issue.
   */
  private getAssigneeDisplayName(issue: JiraMcpIssue): string | null {
    const assignee = issue.fields?.assignee;
    if (!assignee) return null;
    if (typeof assignee === "string") return assignee;
    return assignee.displayName || assignee.emailAddress || null;
  }

  /**
   * Add a comment to a Jira issue via MCP.
   */
  async addComment(issueKey: string, comment: string): Promise<void> {
    await this.connect();

    try {
      await this.callTool("addCommentToJiraIssue", {
        cloudId: this.cloudId,
        issueIdOrKey: issueKey,
        commentBody: comment,
      });
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Transition a Jira issue via MCP.
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.connect();

    try {
      await this.callTool("transitionJiraIssue", {
        cloudId: this.cloudId,
        issueIdOrKey: issueKey,
        transition: { id: transitionId },
      });
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Extract issues array from MCP tool response.
   */
  private extractIssues(result: unknown): JiraMcpIssue[] {
    if (!result || typeof result !== "object") return [];

    // Direct issues array
    if (
      "issues" in result &&
      Array.isArray((result as Record<string, unknown>).issues)
    ) {
      return (result as { issues: JiraMcpIssue[] }).issues;
    }

    // Result might be the array itself
    if (Array.isArray(result)) {
      return result as JiraMcpIssue[];
    }

    return [];
  }

  /**
   * Extract a string value from an MCP field response.
   * MCP responses may wrap values in { value: "..." } or return plain strings.
   */
  private extractFieldValue(
    field: { value?: string } | string | undefined | null,
  ): string {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object" && "value" in field) return field.value || "";
    return String(field);
  }

  /**
   * Format an issue as plain text for AI context.
   */
  private formatIssueAsText(issue: JiraMcpIssue): string {
    const summary = this.extractFieldValue(issue.fields?.summary);
    const status = this.extractFieldValue(issue.fields?.status);
    const issueType = this.extractFieldValue(issue.fields?.issuetype);
    const priority = this.extractFieldValue(issue.fields?.priority);
    const description = this.extractFieldValue(issue.fields?.description);

    const lines: string[] = [
      issue.key,
      summary,
      `TARGET: ${this.defaultRepo}`,
      `SOURCE: ${this.firstBranch}`,
      "",
      `Status: ${status}`,
      `Type: ${issueType}`,
    ];

    if (priority) lines.push(`Priority: ${priority}`);
    if (description) lines.push("", "--- Description ---", description);

    return lines.join("\n");
  }
}
