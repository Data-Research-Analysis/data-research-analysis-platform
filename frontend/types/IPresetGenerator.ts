/**
 * Preset Generator Interface
 */

export interface PresetModel {
    id: string;
    name: string;
    description: string;
    pattern: string;
    confidence: number;
}
