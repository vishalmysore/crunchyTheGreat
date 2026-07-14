import { CompressedContext } from '../model/CompressedContext.js';
import { CompressionLevel } from '../model/CompressionLevel.js';
import { NormalizedDocument } from '../model/NormalizedDocument.js';
import { Block } from './Block.js';
import { SourceText } from './SourceText.js';

/** Shared state passed through every pipeline stage. */
export class ProcessingContext {
  readonly sources: SourceText[] = [];
  readonly blocks: Block[] = [];
  readonly result = new CompressedContext();
  readonly ignoredContent: string[] = [];

  constructor(
    readonly document: NormalizedDocument,
    readonly level: CompressionLevel,
  ) {
    this.sources.push(new SourceText('description', '', false, document.description));
    document.comments.forEach((c, i) => {
      this.sources.push(new SourceText(`comment:${i + 1}`, c.author, c.bot, c.body));
    });
  }

  /** Blocks that survived filtering, deduplication and ranking. */
  liveBlocks(): Block[] {
    return this.blocks.filter((b) => !b.dropped);
  }
}
