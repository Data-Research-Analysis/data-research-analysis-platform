import type { DataModelHealthStatus, IHealthIssue } from '../IDataModelHealth.js';

/**
 * Thrown when a data model's health_status is 'blocked' or its row count
 * exceeds the platform's `max_data_model_rows` threshold.
 *
 * All values are sourced from the `DRADataModel` entity (trusted server-side
 * data). No user-supplied input is reflected in the error payload.
 */
export class DataModelOversizedException extends Error {
    public readonly modelId: number;
    public readonly modelName: string;
    public readonly rowCount: number | null;
    public readonly sourceRowCount: number | null;
    public readonly healthStatus: DataModelHealthStatus;
    public readonly healthIssues: IHealthIssue[];
    public readonly threshold: number;

    constructor(params: {
        modelId: number;
        modelName: string;
        rowCount: number | null;
        sourceRowCount: number | null;
        healthStatus: DataModelHealthStatus;
        healthIssues: IHealthIssue[];
        threshold: number;
    }) {
        const rowDisplay = params.rowCount !== null
            ? params.rowCount.toLocaleString()
            : 'an unknown number of';
        super(
            `This data model contains ${rowDisplay} rows which exceeds the ${params.threshold.toLocaleString()} row chart-building limit.`,
        );
        this.name = 'DataModelOversizedException';
        this.modelId = params.modelId;
        this.modelName = params.modelName;
        this.rowCount = params.rowCount;
        this.sourceRowCount = params.sourceRowCount;
        this.healthStatus = params.healthStatus;
        this.healthIssues = params.healthIssues;
        this.threshold = params.threshold;
    }
}
