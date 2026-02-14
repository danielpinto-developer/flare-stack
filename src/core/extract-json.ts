/**
 * Extract JSON from LLM responses that may contain markdown fences or surrounding text.
 */
export function extractJSON<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1].trim()) as T;
    }
    // Find first {...} block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]) as T;
    }
    throw new Error("No JSON found in LLM response");
  }
}
