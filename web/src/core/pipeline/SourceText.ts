/**
 * A mutable working copy of one raw text unit (the description or a single
 * comment). Cleaning stages rewrite {@link text}; filter stages mark the whole
 * unit removed before it is ever split into blocks.
 */
export class SourceText {
  removed = false;
  removalReason = '';

  constructor(
    public readonly origin: string, // "description" or "comment:<index>"
    public readonly author: string,
    public readonly bot: boolean,
    public text: string,
  ) {
    this.text = text ?? '';
  }

  remove(reason: string): void {
    this.removed = true;
    this.removalReason = reason;
  }
}
