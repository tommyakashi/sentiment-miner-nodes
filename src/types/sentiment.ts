export interface Node {
  id: string;
  name: string;
  keywords: string[];
}

/**
 * KPI scores measure specific qualities in the text.
 * Range: -1.0 (strongly negative) to +1.0 (strongly positive)
 * 
 * - Positive values indicate presence of the quality with positive sentiment
 * - Negative values indicate discussion of the quality with negative sentiment
 * - Values near 0 indicate neutral or absent discussion
 */
export interface KPIScore {
  trust: number;      // -1.0 to +1.0
  optimism: number;   // -1.0 to +1.0
  frustration: number; // -1.0 to +1.0
  clarity: number;    // -1.0 to +1.0
  access: number;     // -1.0 to +1.0
  fairness: number;   // -1.0 to +1.0
}

export interface SentimentResult {
  text: string;
  nodeId: string;
  nodeName: string;
  polarity: 'positive' | 'neutral' | 'negative';
  polarityScore: number;
  kpiScores: KPIScore;
  confidence: number;
}

export interface NodeAnalysis {
  nodeId: string;
  nodeName: string;
  totalTexts: number;
  avgPolarity: number;
  avgKpiScores: KPIScore;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
}
