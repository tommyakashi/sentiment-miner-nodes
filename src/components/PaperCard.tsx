import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResearchPaper } from "@/types/consensus";
import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

interface PaperCardProps {
  paper: ResearchPaper;
  onToggleSelect: (id: string) => void;
}

export const PaperCard = ({ paper, onToggleSelect }: PaperCardProps) => {
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const abstractPreview = paper.abstract.length > 200 
    ? paper.abstract.substring(0, 200) + "..." 
    : paper.abstract;

  return (
    <Card className={paper.selected ? "border-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={paper.selected}
            onCheckedChange={() => onToggleSelect(paper.id)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-base leading-tight">{paper.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{paper.authors.join(", ")}</span>
              <span>•</span>
              <span>{paper.year}</span>
              {paper.journal && (
                <>
                  <span>•</span>
                  <span>{paper.journal}</span>
                </>
              )}
              {paper.citations !== undefined && (
                <>
                  <span>•</span>
                  <span>{paper.citations} citations</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {paper.studyType && (
                <Badge variant="secondary">{paper.studyType}</Badge>
              )}
              {paper.domain && (
                <Badge variant="outline">{paper.domain}</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {showFullAbstract ? paper.abstract : abstractPreview}
        </p>
        {paper.abstract.length > 200 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowFullAbstract(!showFullAbstract)}
            className="h-auto p-0 text-xs"
          >
            {showFullAbstract ? "Show less" : "Show more"}
          </Button>
        )}
        {paper.url && (
          <Button variant="ghost" size="sm" asChild>
            <a href={paper.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-2" />
              View Paper
            </a>
          </Button>
        )}
        {paper.pdfFile && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>{paper.pdfFile.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
