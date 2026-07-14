/** A paragraph-level unit of content flowing through the pipeline. */
export enum Category {
  DECISION = 'DECISION',
  ACCEPTANCE_CRITERIA = 'ACCEPTANCE_CRITERIA',
  BUSINESS_GOAL = 'BUSINESS_GOAL',
  ARCHITECTURE = 'ARCHITECTURE',
  CONSTRAINT = 'CONSTRAINT',
  RISK = 'RISK',
  DEPENDENCY = 'DEPENDENCY',
  TODO = 'TODO',
  DISCUSSION = 'DISCUSSION',
  NOISE = 'NOISE',
}

export class Block {
  readonly categories = new Set<Category>();
  score = 0;
  duplicateCount = 1;
  dropped = false;
  dropReason = '';

  constructor(
    public text: string,
    public readonly origin: string, // "description" or "comment:<index>"
    public readonly author: string,
  ) {}

  incrementDuplicates(): void {
    this.duplicateCount++;
  }

  drop(reason: string): void {
    this.dropped = true;
    this.dropReason = reason;
  }
}
