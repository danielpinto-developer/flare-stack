import { describe, it, expect } from "vitest";
import { FlareConfigSchema } from "../src/config/schema";

describe("Jira Estimation Config", () => {
  it("should have correct defaults", () => {
    const config = FlareConfigSchema.parse({
      project: "test-project",
      repos: {},
    });

    expect(config.jira.estimation).toBeDefined();
    expect(config.jira.estimation.pointsPerHour).toBe(4);
    expect(config.jira.estimation.maxPointsPerTicket).toBe(8);
    expect(config.jira.estimation.buffers.ui).toBe(1);
    expect(config.jira.estimation.buffers.fullStack).toBe(1);
  });

  it("should allow custom overrides", () => {
    const config = FlareConfigSchema.parse({
      project: "test-project",
      repos: {},
      jira: {
        estimation: {
          pointsPerHour: 8, // 1 pt = 8 hours
          maxPointsPerTicket: 13,
          buffers: {
            ui: 2,
            fullStack: 3,
          },
        },
      },
    });

    expect(config.jira.estimation.pointsPerHour).toBe(8);
    expect(config.jira.estimation.maxPointsPerTicket).toBe(13);
    expect(config.jira.estimation.buffers.ui).toBe(2);
    expect(config.jira.estimation.buffers.fullStack).toBe(3);
  });

  it("should handle partial overrides", () => {
    const config = FlareConfigSchema.parse({
      project: "test-project",
      repos: {},
      jira: {
        estimation: {
          pointsPerHour: 6,
        },
      },
    });

    expect(config.jira.estimation.pointsPerHour).toBe(6);
    expect(config.jira.estimation.maxPointsPerTicket).toBe(8); // Default
    expect(config.jira.estimation.buffers.ui).toBe(1); // Default
  });
});
