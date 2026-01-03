import { EPublishStatus } from "./EPublishStatus.js";

export interface ISitemapEntry {
  id: number;
  url: string;
  publish_status: EPublishStatus;
  priority: number;
  created_at: Date;
  updated_at: Date;
}
