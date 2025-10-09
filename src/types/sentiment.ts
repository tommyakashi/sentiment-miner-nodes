export interface Node {
  id: string;
  name: string;
  keywords: string[];
}

export interface KPIScore {
  trust: number;
  optimism: number;
  frustration: number;
  clarity: number;
  access: number;
  fairness: number;
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
