// Public API surface for the deterministic compression core.
export { NormalizedDocument, comment } from './model/NormalizedDocument.js';
export type { Comment } from './model/NormalizedDocument.js';
export { CompressedContext } from './model/CompressedContext.js';
export { CompressionLevel, levelThreshold, parseLevel } from './model/CompressionLevel.js';
export { CompressionPipeline } from './pipeline/CompressionPipeline.js';
export type { PipelineStage } from './pipeline/PipelineStage.js';
export { toJson } from './export/JsonExporter.js';
export { toMarkdown } from './export/MarkdownExporter.js';
export { noOpCompressor } from './compress/SemanticCompressor.js';
export type { SemanticCompressor } from './compress/SemanticCompressor.js';
