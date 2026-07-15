import { Category } from './Block.js';

/**
 * Value score per content category, shared by the ranking stage (which scores
 * blocks) and the assembly stage (which gates CIR sections by compression
 * level). Mirrors the design targets: decisions 0.98, acceptance criteria
 * 0.96, business goals 0.94, plain discussion 0.50, noise ~0.
 */
export const WEIGHTS: Record<Category, number> = {
  [Category.DECISION]: 0.98,
  [Category.ACCEPTANCE_CRITERIA]: 0.96,
  [Category.BUSINESS_GOAL]: 0.94,
  [Category.ARCHITECTURE]: 0.9,
  [Category.CONSTRAINT]: 0.88,
  [Category.RISK]: 0.85,
  [Category.DEPENDENCY]: 0.82,
  [Category.TODO]: 0.78,
  [Category.DISCUSSION]: 0.5,
  [Category.NOISE]: 0.01,
};

export const DEFAULT_WEIGHT = 0.4;

export function weightOf(category: Category): number {
  return WEIGHTS[category] ?? DEFAULT_WEIGHT;
}
