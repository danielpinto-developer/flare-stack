/**
 * FLARE STACK — Production Mirror
 *
 * Queries BigQuery production logs and replays patterns locally.
 * Surface real-world edge cases that tests miss.
 *
 * Workflow:
 *   1. Query BigQuery for recent request patterns (status codes, response times)
 *   2. Identify anomalies (5xx spikes, slow endpoints, error patterns)
 *   3. Generate test scenarios based on real production data
 *
 * Environment Variables:
 *   GOOGLE_CLOUD_PROJECT — GCP project ID
 *   GOOGLE_APPLICATION_CREDENTIALS — Path to service account key
 */

import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";

export interface ProductionPattern {
  endpoint: string;
  method: string;
  statusCode: number;
  avgResponseTime: number;
  count: number;
  errorRate: number;
}

export interface AnomalyReport {
  patterns: ProductionPattern[];
  anomalies: Array<{
    type: "error_spike" | "slow_endpoint" | "unusual_traffic";
    endpoint: string;
    detail: string;
    severity: "low" | "medium" | "high";
  }>;
  suggestions: string[];
  queriedAt: string;
}

/**
 * Query BigQuery for production request patterns.
 */
export async function queryProductionLogs(
  config: FlareConfig,
): Promise<AnomalyReport> {
  if (!config.productionMirror.enabled) {
    throw new Error("Production mirror is disabled in config.");
  }

  const bqConfig = config.productionMirror.bigquery;
  if (!bqConfig) {
    throw new Error("BigQuery config is required for production mirror.");
  }

  const project = bqConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "Missing GOOGLE_CLOUD_PROJECT or bigquery.projectId in config.",
    );
  }

  console.log(
    chalk.cyan(
      `   📊 Querying BigQuery: ${project}.${bqConfig.dataset}.${bqConfig.table}`,
    ),
  );
  console.log(
    chalk.gray(`      Window: last ${bqConfig.windowMinutes} minutes`),
  );

  // BigQuery REST API query
  const query = `
    SELECT 
      request_url AS endpoint,
      request_method AS method,
      response_status AS status_code,
      AVG(response_time_ms) AS avg_response_time,
      COUNT(*) AS request_count,
      COUNTIF(response_status >= 500) / COUNT(*) AS error_rate
    FROM \`${project}.${bqConfig.dataset}.${bqConfig.table}\`
    WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${bqConfig.windowMinutes} MINUTE)
    GROUP BY endpoint, method, status_code
    ORDER BY request_count DESC
    LIMIT 100
  `;

  // Use Google Cloud REST API for BigQuery
  const accessToken = await getGCPAccessToken();

  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        useLegacySql: false,
        maxResults: 100,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`BigQuery API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    rows?: Array<{ f: Array<{ v: string }> }>;
    totalRows?: string;
  };

  // Parse results
  const patterns: ProductionPattern[] = (data.rows || []).map((row) => ({
    endpoint: row.f[0].v,
    method: row.f[1].v,
    statusCode: parseInt(row.f[2].v),
    avgResponseTime: parseFloat(row.f[3].v),
    count: parseInt(row.f[4].v),
    errorRate: parseFloat(row.f[5].v),
  }));

  // Detect anomalies
  const anomalies = detectAnomalies(patterns);
  const suggestions = generateSuggestions(anomalies);

  return {
    patterns,
    anomalies,
    suggestions,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * Detect anomalies in production patterns.
 */
function detectAnomalies(
  patterns: ProductionPattern[],
): AnomalyReport["anomalies"] {
  const anomalies: AnomalyReport["anomalies"] = [];

  for (const p of patterns) {
    // 5xx error spike
    if (p.errorRate > 0.05) {
      anomalies.push({
        type: "error_spike",
        endpoint: `${p.method} ${p.endpoint}`,
        detail: `${(p.errorRate * 100).toFixed(1)}% error rate (${p.count} requests)`,
        severity:
          p.errorRate > 0.2 ? "high" : p.errorRate > 0.1 ? "medium" : "low",
      });
    }

    // Slow endpoint (> 2s average)
    if (p.avgResponseTime > 2000) {
      anomalies.push({
        type: "slow_endpoint",
        endpoint: `${p.method} ${p.endpoint}`,
        detail: `${p.avgResponseTime.toFixed(0)}ms avg response time`,
        severity: p.avgResponseTime > 5000 ? "high" : "medium",
      });
    }
  }

  return anomalies;
}

/**
 * Generate actionable suggestions from anomalies.
 */
function generateSuggestions(anomalies: AnomalyReport["anomalies"]): string[] {
  const suggestions: string[] = [];

  const errorSpikes = anomalies.filter((a) => a.type === "error_spike");
  if (errorSpikes.length > 0) {
    suggestions.push(
      `Investigate ${errorSpikes.length} endpoint(s) with high error rates`,
    );
    for (const spike of errorSpikes.slice(0, 3)) {
      suggestions.push(`  → ${spike.endpoint}: ${spike.detail}`);
    }
  }

  const slowEndpoints = anomalies.filter((a) => a.type === "slow_endpoint");
  if (slowEndpoints.length > 0) {
    suggestions.push(`Optimize ${slowEndpoints.length} slow endpoint(s)`);
    for (const slow of slowEndpoints.slice(0, 3)) {
      suggestions.push(`  → ${slow.endpoint}: ${slow.detail}`);
    }
  }

  if (anomalies.length === 0) {
    suggestions.push("No anomalies detected. Production looks healthy.");
  }

  return suggestions;
}

/**
 * Get a GCP access token using Application Default Credentials.
 */
async function getGCPAccessToken(): Promise<string> {
  // Try gcloud CLI first
  try {
    const { execSync } = await import("child_process");
    const token = execSync("gcloud auth print-access-token 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    if (token) return token;
  } catch {
    // gcloud not available
  }

  // Try metadata server (Cloud Run / GCE)
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    if (response.ok) {
      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    }
  } catch {
    // Not on GCP
  }

  throw new Error(
    "Cannot obtain GCP access token. Run `gcloud auth login` or set GOOGLE_APPLICATION_CREDENTIALS.",
  );
}

/**
 * Print production mirror report.
 */
export function printMirrorReport(report: AnomalyReport): void {
  console.log(chalk.cyan.bold("\n📡 PRODUCTION MIRROR REPORT\n"));
  console.log(chalk.gray(`   Queried: ${report.queriedAt}`));
  console.log(chalk.gray(`   Patterns: ${report.patterns.length}`));
  console.log(chalk.gray(`   Anomalies: ${report.anomalies.length}`));

  if (report.anomalies.length > 0) {
    console.log(chalk.red.bold("\n   ⚠️  ANOMALIES DETECTED:\n"));
    for (const a of report.anomalies) {
      const severityColor =
        a.severity === "high"
          ? chalk.red
          : a.severity === "medium"
            ? chalk.yellow
            : chalk.gray;
      console.log(
        `   ${severityColor(`[${a.severity.toUpperCase()}]`)} ${a.endpoint}`,
      );
      console.log(chalk.gray(`           ${a.detail}`));
    }
  }

  if (report.suggestions.length > 0) {
    console.log(chalk.cyan("\n   💡 SUGGESTIONS:\n"));
    for (const s of report.suggestions) {
      console.log(chalk.white(`   ${s}`));
    }
  }

  console.log("");
}
