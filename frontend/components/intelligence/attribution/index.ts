/**
 * Attribution module — barrel export.
 *
 * Re-exports every sub-component so consumers can write:
 *   import { AttributionView } from '@/components/intelligence/attribution';
 */

export { default as AttributionView } from './AttributionView.vue';
export { default as AttributionModelSelector } from './AttributionModelSelector.vue';
export { default as ChannelAttributionTable } from './ChannelAttributionTable.vue';
export { default as ConversionPathSankey } from './ConversionPathSankey.vue';
export { default as TimeToConversion } from './TimeToConversion.vue';
export { default as AttributionROI } from './AttributionROI.vue';
export { default as FunnelStage } from './FunnelStage.vue';
export { default as ConversionFunnel } from './ConversionFunnel.vue';
export { default as ChannelFunnelComparison } from './ChannelFunnelComparison.vue';
