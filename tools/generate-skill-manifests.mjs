#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'backend', 'skills', 'paid-media');

const COMMON_MODEL = { name: process.env.PLAN_MODEL || 'gemini-2.5-flash', temperature: 0.3 };
const COMMON_MAX_TOOL_CALLS = 40;

const READ_STATE_TOOLS = ['read_state', 'read_artifact'];
const WRITE_TOOLS = ['write_artifact', 'write_state'];

const steps = [
  {
    id: 'intake',
    stepNumber: 0,
    stepKey: 'intake',
    title: 'Plan intake',
    skillFile: 'SKILL.md',
    requires: [],
    inputs: ['project context', 'connected accounts', 'objective', 'budget'],
    tools: ['read_state', 'ask_user', 'write_state'],
    gate: { afterRun: true, type: 'confirm_funnel_build_mode', question: 'Confirm your funnel coverage and build mode before we continue.' },
    artifacts: [],
    stateWrites: ['core_facts', 'funnel_and_scale', 'basic_mode_source'],
    outputContract: { type: 'state', requiredFields: ['core_facts', 'funnel_and_scale'] },
  },
  {
    id: 'pm-brief',
    stepNumber: 1,
    stepKey: 'pm-brief',
    title: 'Creative brief',
    skillFile: 'SKILL.md',
    requires: ['intake'],
    inputs: ['mode', 'website', 'core_facts'],
    tools: ['web_fetch', 'web_search', 'write_artifact', 'write_state', 'ask_user'],
    gate: { afterRun: true, type: 'confirm_brief', question: 'Your creative brief is ready. Confirm these before I continue.' },
    artifacts: [{ key: '01-creative-brief', kind: 'markdown', path: '01-creative-brief.md', title: 'Creative brief' }],
    stateWrites: ['core_facts', 'funnel_and_scale', 'step_outputs.pm-brief'],
    outputContract: { type: 'markdown', requiredSections: ['Core facts', 'Funnel and scale'] },
  },
  {
    id: 'pm-market-research',
    stepNumber: 2,
    stepKey: 'pm-market-research',
    title: 'Market research',
    skillFile: 'SKILL.md',
    requires: ['pm-brief'],
    inputs: ['core_facts', 'markets'],
    tools: ['web_search', 'web_fetch', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '02-market-research', kind: 'markdown', path: '02-market-research.md', title: 'Market research' }],
    stateWrites: ['step_outputs.pm-market-research'],
    outputContract: { type: 'markdown', requiredSections: ['Industry', 'Market benchmarks', 'Own baseline'] },
  },
  {
    id: 'pm-competitor-research',
    stepNumber: 3,
    stepKey: 'pm-competitor-research',
    title: 'Competitor research',
    skillFile: 'SKILL.md',
    requires: ['pm-brief'],
    inputs: ['core_facts', 'competitors'],
    tools: ['web_search', 'web_fetch', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '03-competitor-paid-media-research', kind: 'markdown', path: '03-competitor-paid-media-research.md', title: 'Competitor paid media research' }],
    stateWrites: ['step_outputs.pm-competitor-research'],
    outputContract: { type: 'markdown', requiredSections: ['Competitors', 'Paid activity', 'VERIFIED sources'] },
  },
  {
    id: 'pm-company-paid-audit',
    stepNumber: 31,
    stepKey: 'pm-company-paid-audit',
    title: 'Company paid audit',
    skillFile: 'SKILL.md',
    requires: ['pm-brief'],
    inputs: ['core_facts', 'platforms'],
    tools: ['web_search', 'web_fetch', 'query_marketing_metrics', 'list_connected_accounts', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '03a-company-paid-media-audit', kind: 'markdown', path: '03a-company-paid-media-audit.md', title: 'Company paid media audit' }],
    stateWrites: ['step_outputs.pm-company-paid-audit'],
    outputContract: { type: 'markdown', requiredSections: ['Current paid activity', 'Platforms', 'Gaps'] },
  },
  {
    id: 'pm-audience-analysis',
    stepNumber: 4,
    stepKey: 'pm-audience-analysis',
    title: 'Audience analysis',
    skillFile: 'SKILL.md',
    requires: ['pm-brief'],
    inputs: ['core_facts', 'funnel_and_scale'],
    tools: ['web_search', 'read_state', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '04-audience-analysis-avatars', kind: 'markdown', path: '04-audience-analysis-avatars.md', title: 'Audience analysis avatars' }],
    stateWrites: ['step_outputs.pm-audience-analysis'],
    outputContract: { type: 'markdown', requiredSections: ['Avatars', 'Avatar to campaign map'] },
  },
  {
    id: 'pm-keyword-research',
    stepNumber: 5,
    stepKey: 'pm-keyword-research',
    title: 'Keyword research',
    skillFile: 'SKILL.md',
    requires: ['pm-audience-analysis', 'pm-competitor-research'],
    inputs: ['core_facts', 'step_outputs.pm-audience-analysis'],
    tools: ['web_search', 'web_fetch', 'query_marketing_metrics', 'write_artifact', 'write_state', 'ask_user'],
    gate: { afterRun: true, type: 'confirm_urls_live', question: 'Confirm your destination URLs are live before we build on them.' },
    artifacts: [{ key: '05-keyword-destination-url-plan', kind: 'markdown', path: '05-keyword-destination-url-plan.md', title: 'Keyword and destination URL plan' }],
    stateWrites: ['step_outputs.pm-keyword-research'],
    outputContract: { type: 'markdown', requiredSections: ['Search clusters', 'Display and Meta targeting', 'Destination URLs'] },
  },
  {
    id: 'pm-ad-copy',
    stepNumber: 6,
    stepKey: 'pm-ad-copy',
    title: 'Ad copy',
    skillFile: 'SKILL.md',
    requires: ['pm-keyword-research'],
    inputs: ['step_outputs.pm-keyword-research', 'step_outputs.pm-audience-analysis'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '06-ad-copy', kind: 'markdown', path: '06-ad-copy.md', title: 'Ad copy' }],
    stateWrites: ['step_outputs.pm-ad-copy'],
    outputContract: { type: 'markdown', requiredSections: ['RSA', 'Display', 'Meta copy'] },
  },
  {
    id: 'pm-creatives',
    stepNumber: 7,
    stepKey: 'pm-creatives',
    title: 'Creatives',
    skillFile: 'SKILL.md',
    requires: ['pm-ad-copy'],
    inputs: ['step_outputs.pm-ad-copy'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '07-creatives', kind: 'markdown', path: '07-creatives.md', title: 'Creatives' }],
    stateWrites: ['step_outputs.pm-creatives'],
    outputContract: { type: 'markdown', requiredSections: ['Image prompts', 'Video scripts', 'Creative packs'] },
  },
  {
    id: 'pm-landing-page-copy',
    stepNumber: 8,
    stepKey: 'pm-landing-page-copy',
    title: 'Landing page copy',
    skillFile: 'SKILL.md',
    requires: ['pm-ad-copy'],
    inputs: ['step_outputs.pm-ad-copy', 'core_facts'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '08-landing-page-copy', kind: 'markdown', path: '08-landing-page-copy.md', title: 'Landing page copy' }],
    stateWrites: ['step_outputs.pm-landing-page-copy'],
    outputContract: { type: 'markdown', requiredSections: ['Hero variants', 'Page copy'] },
  },
  {
    id: 'pm-landing-page-implementation',
    stepNumber: 9,
    stepKey: 'pm-landing-page-implementation',
    title: 'Landing page implementation',
    skillFile: 'SKILL.md',
    requires: ['pm-landing-page-copy'],
    inputs: ['step_outputs.pm-landing-page-copy'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '09-landing-page-implementation', kind: 'markdown', path: '09-landing-page-implementation.md', title: 'Landing page implementation plan' }],
    stateWrites: ['step_outputs.pm-landing-page-implementation'],
    outputContract: { type: 'markdown', requiredSections: ['Build plan'] },
  },
  {
    id: 'pm-media-plan',
    stepNumber: 10,
    stepKey: 'pm-media-plan',
    title: 'Media plan',
    skillFile: 'SKILL.md',
    requires: ['pm-market-research', 'pm-keyword-research'],
    inputs: ['core_facts', 'markets', 'budget', 'step_outputs.pm-market-research'],
    tools: ['read_state', 'read_benchmarks', 'write_artifact', 'write_state', 'run_script', 'ask_user'],
    artifacts: [
      { key: '10-media-plan', kind: 'markdown', path: '10-media-plan.md', title: 'Media plan' },
      { key: '10-media-plan-xlsx', kind: 'xlsx', path: '10-media-plan.xlsx', title: 'Media plan (xlsx)', script: 'media-plan-xlsx' },
    ],
    stateWrites: ['step_outputs.pm-media-plan'],
    outputContract: { type: 'markdown', requiredSections: ['Budget allocation', 'Forecast', 'Bid caps'] },
  },
  {
    id: 'pm-tracking-setup',
    stepNumber: 11,
    stepKey: 'pm-tracking-setup',
    title: 'Tracking setup',
    skillFile: 'SKILL.md',
    requires: ['pm-media-plan'],
    inputs: ['step_outputs.pm-media-plan', 'core_facts'],
    tools: ['read_state', 'web_fetch', 'write_artifact', 'write_state', 'ask_user'],
    gate: { afterRun: true, type: 'confirm_tracking', question: 'Confirm your tracking plan before launch.' },
    artifacts: [{ key: '11-tracking-setup', kind: 'markdown', path: '11-tracking-setup.md', title: 'Tracking setup' }],
    stateWrites: ['step_outputs.pm-tracking-setup'],
    outputContract: { type: 'markdown', requiredSections: ['GA4', 'GTM', 'Pixel events'] },
  },
  {
    id: 'pm-campaign-build',
    stepNumber: 12,
    stepKey: 'pm-campaign-build',
    title: 'Campaign build guide',
    skillFile: 'SKILL.md',
    requires: ['pm-tracking-setup'],
    inputs: ['step_outputs.pm-media-plan', 'step_outputs.pm-tracking-setup'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '12-campaign-build-guide', kind: 'markdown', path: '12-campaign-build-guide.md', title: 'Campaign build guide' }],
    stateWrites: ['step_outputs.pm-campaign-build'],
    outputContract: { type: 'markdown', requiredSections: ['Google build', 'Meta build'] },
  },
  {
    id: 'pm-setup-checklist',
    stepNumber: 13,
    stepKey: 'pm-setup-checklist',
    title: 'Setup checklist',
    skillFile: 'SKILL.md',
    requires: ['pm-campaign-build'],
    inputs: ['step_outputs.pm-campaign-build'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'run_script'],
    gate: { afterRun: true, type: 'pre_launch_qa', question: 'Pre-launch QA. Confirm the setup checklist before launch.' },
    artifacts: [
      { key: '13-setup-checklist', kind: 'markdown', path: '13-setup-checklist.md', title: 'Setup checklist' },
      { key: '13-setup-checklist-xlsx', kind: 'xlsx', path: '13-setup-checklist.xlsx', title: 'Setup checklist (xlsx)', script: 'setup-checklist-xlsx' },
    ],
    stateWrites: ['step_outputs.pm-setup-checklist'],
    outputContract: { type: 'markdown', requiredSections: ['Google checklist', 'Meta checklist', 'Tracking checklist'] },
  },
  {
    id: 'pm-results-review',
    stepNumber: 14,
    stepKey: 'pm-results-review',
    title: 'Results review',
    skillFile: 'SKILL.md',
    requires: ['pm-setup-checklist'],
    inputs: ['step_outputs.pm-media-plan', 'targets'],
    tools: ['query_marketing_metrics', 'read_state', 'read_artifact', 'write_artifact', 'write_state', 'ask_user'],
    artifacts: [{ key: '14-results-review', kind: 'markdown', path: '14-results-review.md', title: 'Results review' }],
    stateWrites: ['step_outputs.pm-results-review'],
    outputContract: { type: 'markdown', requiredSections: ['Daily routine', 'Winner criteria', 'Scale decision'] },
  },
  {
    id: 'pm-client-presentation',
    stepNumber: 15,
    stepKey: 'pm-client-presentation',
    title: 'Client presentation deck',
    skillFile: 'SKILL.md',
    requires: ['pm-results-review'],
    inputs: ['core_facts', 'step_outputs', 'all artifacts'],
    tools: ['read_state', 'read_artifact', 'write_artifact', 'write_state', 'run_script', 'ask_user'],
    artifacts: [
      { key: '00-strategy-deck-content', kind: 'json', path: '00-strategy-deck-content.json', title: 'Strategy deck content' },
      { key: '00-digital-marketing-strategy-deck', kind: 'pptx', path: '00-digital-marketing-strategy-deck.pptx', title: 'Digital marketing strategy deck', script: 'strategy-deck-pptx' },
    ],
    scripts: ['build_deck.py'],
    stateWrites: ['step_outputs.pm-client-presentation'],
    outputContract: { type: 'json', requiredFields: ['slides'] },
  },
  {
    id: 'plan-index',
    stepNumber: 16,
    stepKey: 'plan-index',
    title: 'Plan index',
    skillFile: '../_shared/orchestrator.md',
    requires: ['pm-client-presentation'],
    inputs: ['all artifacts'],
    tools: ['read_state', 'read_artifact', 'write_artifact'],
    artifacts: [{ key: '00-plan-index', kind: 'markdown', path: '00-plan-index.md', title: 'Plan index' }],
    stateWrites: [],
    outputContract: { type: 'markdown', requiredSections: ['Index', 'Artifacts'] },
  },
];

function validate(steps) {
  const keys = new Set();
  for (const step of steps) {
    if (keys.has(step.stepKey)) {
      throw new Error(`Duplicate stepKey ${step.stepKey}`);
    }
    keys.add(step.stepKey);
    if (step.stepKey !== 'intake' && step.stepKey !== 'plan-index' && !step.skillFile) {
      throw new Error(`${step.stepKey} has no skillFile`);
    }
    for (const req of step.requires) {
      if (!keys.has(req) && !steps.find((s) => s.stepKey === req)) {
        throw new Error(`${step.stepKey} requires unknown step ${req}`);
      }
    }
  }
  return true;
}

validate(steps);

for (const step of steps) {
  const manifest = {
    id: step.id,
    stepNumber: step.stepNumber,
    stepKey: step.stepKey,
    title: step.title,
    version: '1.0.0',
    skillFile: step.skillFile,
    requires: step.requires,
    inputs: step.inputs,
    tools: step.tools,
    gate: step.gate ?? null,
    artifacts: step.artifacts,
    stateWrites: step.stateWrites,
    systemPromptRef: `${step.skillFile}#workflow`,
    outputContract: step.outputContract,
    model: COMMON_MODEL,
    maxToolCalls: COMMON_MAX_TOOL_CALLS,
  };
  const dir = join(SKILLS_DIR, `${step.stepNumber === 31 ? '03a' : String(step.stepNumber).padStart(2, '0')}-${step.stepKey === 'intake' ? 'intake' : step.stepKey === 'plan-index' ? 'plan-index' : step.stepKey}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${dir}/manifest.json`);
}
