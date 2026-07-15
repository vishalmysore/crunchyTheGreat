import { CompressedContext } from '../model/CompressedContext.js';
import { CompressionLevel } from '../model/CompressionLevel.js';
import { NormalizedDocument } from '../model/NormalizedDocument.js';
import { Block, Category } from './Block.js';
import { SourceText } from './SourceText.js';

/** The CIR list an extracted sentence belongs to. */
export type CirListName =
  | 'decisions'
  | 'constraints'
  | 'acceptanceCriteria'
  | 'risks'
  | 'todos'
  | 'dependencies';

/**
 * One extracted sentence, tagged with the category that determines its value
 * score. Extraction records these instead of writing straight into the result,
 * so the assembly stage can gate them by compression level.
 */
export interface Extract {
  list: CirListName;
  text: string;
  category: Category;
  block: Block;
}

/** Shared state passed through every pipeline stage. */
export class ProcessingContext {
  readonly sources: SourceText[] = [];
  readonly blocks: Block[] = [];
  readonly result = new CompressedContext();
  readonly ignoredContent: string[] = [];
  readonly extracts: Extract[] = [];

  constructor(
    readonly document: NormalizedDocument,
    readonly level: CompressionLevel,
  ) {
    this.sources.push(new SourceText('description', '', false, document.description));
    document.comments.forEach((c, i) => {
      this.sources.push(new SourceText(`comment:${i + 1}`, c.author, c.bot, c.body));
    });
  }

  /** Records an extracted sentence and tags its source block's category. */
  addExtract(list: CirListName, text: string, category: Category, block: Block): void {
    block.categories.add(category);
    this.extracts.push({ list, text, category, block });
  }

  /** Blocks that survived filtering, deduplication and ranking. */
  liveBlocks(): Block[] {
    return this.blocks.filter((b) => !b.dropped);
  }
}
