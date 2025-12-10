import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ComparisonRow {
  pre: string;
  post: string;
  metric: string;
  insight: string;
}

const comparisonData: ComparisonRow[] = [
  {
    pre: "~60%",
    post: "99%",
    metric: "Stability Performance",
    insight: "The model has the utmost performance assurance and confidence in its security"
  },
  {
    pre: "~5 min",
    post: "~40s",
    metric: "Average Analysis Time",
    insight: "Total time has been reduced by the server-side migration of the model's runtime analysis"
  },
  {
    pre: "~150",
    post: "1000+",
    metric: "Text Analyzed / Minute",
    insight: "Improved text analyzed per minute means that users can maximize the model's capability"
  },
  {
    pre: "0",
    post: "43",
    metric: "Subreddits Monitored",
    insight: "Through the overhauled reddit scraper, 43 subreddits are scraped over determined times"
  }
];

export const OverhaulComparison = () => {
  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold tracking-wide text-center">
          OVERHAUL COMPARISON
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-center font-bold text-foreground w-20">Pre</TableHead>
              <TableHead className="text-center font-bold text-foreground w-20">Post</TableHead>
              <TableHead className="text-center font-bold text-foreground">Metric</TableHead>
              <TableHead className="text-center font-bold text-foreground">Insight</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((row, index) => (
              <TableRow key={index} className="border-border/30">
                <TableCell className="text-center font-mono text-muted-foreground">
                  {row.pre}
                </TableCell>
                <TableCell className="text-center font-mono font-semibold text-primary">
                  {row.post}
                </TableCell>
                <TableCell className="text-center font-medium bg-primary/10">
                  {row.metric}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground bg-muted/30">
                  {row.insight}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
