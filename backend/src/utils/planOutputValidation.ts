/**
 * Validation helpers for plan step outputs.
 *
 * A plan step must end with a deliverable, never with a request for input.
 * In basic mode the pipeline never asks questions (the `ask_user` tool is
 * removed and gates are auto-approved), so a model that follows a skill's
 * "confirm with the user" instruction can only express it by writing the
 * question into its final text. These helpers detect that output so the step
 * fails instead of salvaging a clarification as a deliverable.
 */

const CLARIFICATION_PHRASES = [
    'please confirm',
    'please provide',
    'please share',
    'could you',
    'can you please',
    'would you like to',
    'let me know',
    'before i proceed',
    'before we proceed',
    'confirm the industry',
    'confirm from state',
    'do you have',
    'does your',
    'do they have',
    'share the urls',
    'provide the urls',
    'need from you',
    'ask you to',
    'i should audit',
    'have any existing',
    'any existing social',
    'what is the industry',
    'which industry',
];

/**
 * Returns true when `text` reads as a request for input (a clarification or a
 * question prompt) rather than a deliverable.
 *
 * A real deliverable is structured (markdown headings, lists, tables) and does
 * not end by asking the user for something. Clarification output is typically
 * short, free-form prose that contains a question mark and a request phrase.
 */
export function isClarificationOnlyText(text: string): boolean {
    const trimmed = (text ?? '').trim();
    if (trimmed.length === 0) return false;

    // Structured content (headings, bullet/numbered lists, block quotes, tables)
    // is a deliverable, even if it contains an occasional rhetorical question.
    const hasStructure = /(^|\n)\s*(#{1,3}\s|\*{1,3}\s|[-+>]\s|\d+\.\s)/.test(trimmed) || trimmed.includes('|');
    if (hasStructure) return false;

    const lower = trimmed.toLowerCase();
    const hasClarificationPhrase = CLARIFICATION_PHRASES.some((phrase) => lower.includes(phrase));
    const endsWithQuestion = /[?？]\s*$/.test(trimmed);
    const questionMarkCount = (trimmed.match(/[?？]/g) ?? []).length;

    // Short, unstructured text that asks or requests input is a prompt, not a
    // deliverable (e.g. "Please confirm the industry before I proceed.").
    if (trimmed.length < 120) {
        return hasClarificationPhrase || endsWithQuestion || questionMarkCount > 0;
    }

    // Longer text only counts as a clarification when it is unmistakably a
    // request: a request phrase combined with at least one question mark.
    return hasClarificationPhrase && questionMarkCount >= 1;
}
