/**
 * FLARE STACK — Ticket Types
 *
 * Shared interfaces for ticket data across the Jira REST API source.
 */

export interface Ticket {
  /** Ticket ID e.g. PROJ-001 */
  id: string;
  /** Target repository name from config */
  targetRepo: string;
  /** Source branch to base the worktree on */
  sourceBranch: string;
  /** Full raw text block from Jira */
  rawContent: string;
  /** Parsed summary (first descriptive line) */
  summary?: string;
  /** Assignee display name from Jira */
  assignee?: string;
}

export interface TicketSource {
  /** Unique name for this source */
  name: string;
  /** Parse tickets from this source */
  parse(): Promise<Ticket[]>;
}
