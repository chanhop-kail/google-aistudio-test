export interface SpecItem {
  key: string;
  value: string;
}

export interface SubmissionValidation {
  status: 'pass' | 'fail' | 'partial';
  missingDocs: string[];
  details: string;
}

export interface ExtractedProduct {
  id: string;
  fileName: string;
  productName: string;
  modelName: string;
  manufacturer: string;
  detailedItemName: string;
  itemNumber: string;
  firstStageDocuments: string[];
  specifications: SpecItem[];
  features: string[];
  submissionValidation?: SubmissionValidation;
}

export interface ComparisonResult {
  summary: string;
}
