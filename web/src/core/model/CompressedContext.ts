/**
 * Context Intermediate Representation (CIR): the standardized JSON contract
 * consumed by AI agents, independent of which connector produced the input.
 *
 * Field declaration order below is the JSON key order (JSON.stringify emits
 * own properties in insertion order), matching the documented CIR schema.
 */
export class CompressedContext {
  issue = '';
  summary = '';
  businessGoal = '';
  architecture: string[] = [];
  decisions: string[] = [];
  constraints: string[] = [];
  acceptanceCriteria: string[] = [];
  risks: string[] = [];
  todos: string[] = [];
  dependencies: string[] = [];
  relatedIssues: string[] = [];
  ignoredContent: string[] = [];
  confidence = 0;
  compressionRatio = 0;
}
