import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STUDY_TYPES, DOMAINS, ResearchPaper } from "@/types/consensus";
import { extractTextFromPDF } from "@/utils/pdfParser";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface PaperUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaperAdd: (paper: ResearchPaper) => void;
}

export const PaperUploadDialog = ({ open, onOpenChange, onPaperAdd }: PaperUploadDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: new Date().getFullYear(),
    journal: "",
    abstract: "",
    url: "",
    studyType: "",
    domain: "",
  });
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    setPdfFile(file);
    setIsProcessing(true);

    try {
      const textPages = await extractTextFromPDF(file);
      // Auto-fill title from filename if not set
      if (!formData.title) {
        const titleFromFile = file.name.replace(".pdf", "").replace(/_/g, " ");
        setFormData(prev => ({ ...prev, title: titleFromFile }));
      }
    } catch (error) {
      console.error("Error parsing PDF:", error);
      toast({
        title: "PDF parsing failed",
        description: "Could not extract text from PDF. You can still add it manually.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.authors || !formData.abstract) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, authors, and abstract",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      let fullText = "";
      if (pdfFile) {
        const textPages = await extractTextFromPDF(pdfFile);
        fullText = textPages.join("\n\n");
      }

      const newPaper: ResearchPaper = {
        id: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        authors: formData.authors.split(",").map(a => a.trim()),
        year: formData.year,
        journal: formData.journal || undefined,
        abstract: formData.abstract,
        fullText: fullText || undefined,
        url: formData.url || undefined,
        pdfFile: pdfFile || undefined,
        studyType: formData.studyType || undefined,
        domain: formData.domain || undefined,
        uploadedAt: new Date(),
        selected: false,
      };

      onPaperAdd(newPaper);
      
      toast({
        title: "Paper added",
        description: "Research paper has been added successfully",
      });

      // Reset form
      setFormData({
        title: "",
        authors: "",
        year: new Date().getFullYear(),
        journal: "",
        abstract: "",
        url: "",
        studyType: "",
        domain: "",
      });
      setPdfFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding paper:", error);
      toast({
        title: "Error adding paper",
        description: "An error occurred while processing the paper",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Research Paper</DialogTitle>
          <DialogDescription>
            Upload a PDF and fill in the paper details. All fields can be edited.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pdf-upload">PDF File (Optional)</Label>
            <div className="mt-2">
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              {pdfFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Paper title"
              required
            />
          </div>

          <div>
            <Label htmlFor="authors">Authors * (comma-separated)</Label>
            <Input
              id="authors"
              value={formData.authors}
              onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
              placeholder="Smith J., Johnson A., Williams B."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="journal">Journal</Label>
              <Input
                id="journal"
                value={formData.journal}
                onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                placeholder="Nature, Science, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="study-type">Study Type</Label>
              <Select value={formData.studyType} onValueChange={(value) => setFormData({ ...formData, studyType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Select value={formData.domain} onValueChange={(value) => setFormData({ ...formData, domain: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="url">Paper URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="abstract">Abstract *</Label>
            <Textarea
              id="abstract"
              value={formData.abstract}
              onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
              placeholder="Paper abstract..."
              rows={6}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Add Paper"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
