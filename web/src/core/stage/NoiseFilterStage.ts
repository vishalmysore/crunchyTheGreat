import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { looksLikeLogDump } from '../text/TextUtil.js';

/**
 * Removes whole source texts that carry no engineering signal: bot chatter,
 * greetings/acknowledgements, emoji spam and raw log dumps.
 */
const BOT_AUTHOR = /\b(bot|jenkins|automation|pipeline|github-actions|dependabot|sonar)\b/i;
const BOT_BODY =
  /^(build\s+#?\d+\s+(started|succeeded|failed|passed)|deployment\s+(started|completed|triggered)|branch\s+\S+\s+was\s+(created|deleted)).*$/i;
const GREETING_ONLY =
  /^(?:(?:hi|hello|hey)(?: (?:team|all|everyone|folks|guys))?|thanks|thank you|thx|ty|\+1|lgtm|ok|okay|sounds good|got it|noted|any update\??|ping|bump)[\s!.,]*$/i;
const EMOJI_OR_SYMBOL = /^[\p{So}\p{Sk}\p{Cs}:;()[\]{}\-_*+~^\s]+$/u;

export class NoiseFilterStage implements PipelineStage {
  readonly name = 'noise-filter';

  process(context: ProcessingContext): void {
    let bots = 0;
    let greetings = 0;
    let logDumps = 0;
    let emoji = 0;
    for (const source of context.sources) {
      if (source.removed || source.origin === 'description') {
        continue;
      }
      const text = source.text;
      if (text.trim().length === 0) {
        source.remove('empty');
        continue;
      }
      const trimmed = text.trim();
      if (source.bot || BOT_AUTHOR.test(source.author) || BOT_BODY.test(trimmed)) {
        source.remove('bot message');
        bots++;
      } else if (GREETING_ONLY.test(trimmed)) {
        source.remove('greeting/acknowledgement');
        greetings++;
      } else if (EMOJI_OR_SYMBOL.test(text)) {
        source.remove('emoji/symbol spam');
        emoji++;
      } else if (looksLikeLogDump(text)) {
        source.remove('log dump');
        logDumps++;
        context.ignoredContent.push(
          `Log/stack-trace dump removed from ${source.origin} (${text.length} chars)`,
        );
      }
    }
    if (bots > 0) {
      context.ignoredContent.push(`${bots} bot message(s) removed`);
    }
    if (greetings > 0) {
      context.ignoredContent.push(`${greetings} greeting/acknowledgement comment(s) removed`);
    }
    if (emoji > 0) {
      context.ignoredContent.push(`${emoji} emoji-only comment(s) removed`);
    }
    void logDumps;
  }
}
