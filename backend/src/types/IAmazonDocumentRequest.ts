import { AdaptersConfig, FeatureType, HumanLoopConfig, QueriesConfig } from "@aws-sdk/client-textract";

export interface IAmazonDocumentRequest {
    Document: {
        Bytes: Buffer;
        S3Object?: {
            Bucket: string;
            Name: string;
            Version?: string;
        };
    },
    FeatureTypes: FeatureType[];
    HumanLoopConfig?: HumanLoopConfig;
    QueriesConfig?: QueriesConfig;
    AdaptersConfig?: AdaptersConfig;
}