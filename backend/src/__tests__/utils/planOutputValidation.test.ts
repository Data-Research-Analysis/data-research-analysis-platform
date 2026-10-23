/**
 * Tests for planOutputValidation utility
 */

import { describe, it, expect } from '@jest/globals';
import { isClarificationOnlyText } from '../../utils/planOutputValidation.js';

describe('isClarificationOnlyText', () => {
    it('returns false for empty or whitespace-only text', () => {
        expect(isClarificationOnlyText('')).toBe(false);
        expect(isClarificationOnlyText('   ')).toBe(false);
        expect(isClarificationOnlyText(null as any)).toBe(false);
    });

    it('returns false for a normal deliverable paragraph without questions', () => {
        const text = 'The market research covers global market sizing, platform penetration and trends.';
        expect(isClarificationOnlyText(text)).toBe(false);
    });

    it('returns false for a structured deliverable even when it contains a question', () => {
        const text = [
            '# Market Research',
            '',
            '## 1. Global Market Sizing',
            '',
            '| Source | Size | CAGR |',
            '| --- | --- | --- |',
            '| Gartner | 8.02B | 12.6% |',
            '',
            'What this means for the company: the category is growing.',
        ].join('\n');
        expect(isClarificationOnlyText(text)).toBe(false);
    });

    it('returns false for a structured deliverable with bullet lists and a closing question', () => {
        const text = [
            '## Own baseline',
            '',
            '- Website: https://www.dataresearchanalysis.com/',
            '- No public paid activity found',
            '',
            'Is anything missing from this audit?',
        ].join('\n');
        expect(isClarificationOnlyText(text)).toBe(false);
    });

    it('returns true for the production clarification output (asks for industry confirmation)', () => {
        const text = [
            'I understand the company is "DRA Paid Media Plan 2026" and its website is `https://www.dataresearchanalysis.com/`. Based on the website, the company offers an AI-powered paid media plan builder and campaign intelligence platform.',
            '',
            'Before I proceed with the market research, could you please confirm the industry for "DRA Paid Media Plan 2026"? I\'ve tentatively identified it as Marketing Technology (MarTech) or Digital Marketing Software.',
            '',
            'Also, does "DRA Paid Media Plan 2026" have any existing social media channels or paid campaigns that I should audit? If so, please provide the URLs for the social media channels and any details about prior paid campaigns.',
        ].join('\n');
        expect(isClarificationOnlyText(text)).toBe(true);
    });

    it('returns true for a short question-only prompt', () => {
        expect(isClarificationOnlyText('Which industry should I research?')).toBe(true);
    });

    it('returns true for a single clarification question', () => {
        expect(isClarificationOnlyText('Please confirm the industry before I proceed.')).toBe(true);
    });

    it('returns true for a request for channel URLs', () => {
        const text = 'Could you provide the URLs for your social media channels and any details about prior paid campaigns?';
        expect(isClarificationOnlyText(text)).toBe(true);
    });

    it('returns true for uppercase clarification phrases', () => {
        const text = 'PLEASE CONFIRM THE INDUSTRY BEFORE I PROCEED.';
        expect(isClarificationOnlyText(text)).toBe(true);
    });

    it('returns false for unstructured text with questions but no clarification phrase when it is long', () => {
        const text = 'Is the market growing fast enough to justify entry? Are budgets large enough to matter? These are the questions this report evaluates with data.'.repeat(3);
        expect(isClarificationOnlyText(text)).toBe(false);
    });
});
