import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResearchFiltersComponent } from "@/components/ResearchFilters";
import { PaperCard } from "@/components/PaperCard";
import { PaperUploadDialog } from "@/components/PaperUploadDialog";
import { ProjectSelector } from "@/components/ProjectSelector";
import { ProjectManager } from "@/components/ProjectManager";
import { ResearchPaper, ResearchFilters } from "@/types/consensus";
import { Upload, Download, Trash2, Search, FileText, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useResearchProject } from "@/hooks/useResearchProject";

const Research = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [projectManagerMode, setProjectManagerMode] = useState<'create' | 'edit'>('create');
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ResearchFilters>({
    yearMin: 2015,
    yearMax: new Date().getFullYear(),
    studyTypes: [],
    domains: [],
    searchQuery: "",
  });

  const {
    projects,
    currentProject,
    isLoading,
    fetchProjectWithPapers,
    createProject,
    updateProject,
    deleteProject,
    addPaperToProject,
    addPapersToProject,
    removePapersFromProject,
  } = useResearchProject();

  // Auto-select first project on load
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      fetchProjectWithPapers(projects[0].id);
    }
  }, [projects, currentProject]);

  // Clear selection when project changes
  useEffect(() => {
    setSelectedPaperIds(new Set());
  }, [currentProject?.id]);

  const papers = currentProject?.papers.map(pp => ({
    ...pp.paper_data,
    selected: selectedPaperIds.has(pp.paper_data.id),
  })) || [];

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      // Year filter
      if (paper.year < filters.yearMin || paper.year > filters.yearMax) {
        return false;
      }

      // Study type filter
      if (filters.studyTypes.length > 0 && paper.studyType) {
        if (!filters.studyTypes.includes(paper.studyType)) {
          return false;
        }
      }

      // Domain filter
      if (filters.domains.length > 0 && paper.domain) {
        if (!filters.domains.includes(paper.domain)) {
          return false;
        }
      }

      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchableText = [
          paper.title,
          paper.abstract,
          ...paper.authors,
          paper.journal || "",
        ].join(" ").toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [papers, filters]);

  const selectedPapers = filteredPapers.filter(p => p.selected);
  const selectedCount = selectedPapers.length;

  const handleToggleSelect = (id: string) => {
    setSelectedPaperIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allSelected = filteredPapers.every(p => selectedPaperIds.has(p.id));
    if (allSelected) {
      // Deselect all filtered papers
      setSelectedPaperIds(prev => {
        const newSet = new Set(prev);
        filteredPapers.forEach(p => newSet.delete(p.id));
        return newSet;
      });
    } else {
      // Select all filtered papers
      setSelectedPaperIds(prev => {
        const newSet = new Set(prev);
        filteredPapers.forEach(p => newSet.add(p.id));
        return newSet;
      });
    }
  };

  const handleClearFilters = () => {
    setFilters({
      yearMin: 2015,
      yearMax: new Date().getFullYear(),
      studyTypes: [],
      domains: [],
      searchQuery: "",
    });
  };

  const handlePaperAdd = async (paper: ResearchPaper) => {
    if (!currentProject) {
      // Auto-create a project if none exists
      const newProject = await createProject("My Research Project");
      if (newProject) {
        await addPaperToProject(newProject.id, paper);
      }
    } else {
      await addPaperToProject(currentProject.id, paper);
    }
  };

  const handleDeleteSelected = async () => {
    if (!currentProject) return;
    
    const selectedPaperDbIds = currentProject.papers
      .filter(pp => selectedPaperIds.has(pp.paper_data.id))
      .map(pp => pp.id);
    
    if (selectedPaperDbIds.length > 0) {
      await removePapersFromProject(selectedPaperDbIds);
      setSelectedPaperIds(new Set());
    }
  };

  const handleExportCSV = () => {
    if (selectedCount === 0) {
      toast({
        title: "No papers selected",
        description: "Please select papers to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Title", "Authors", "Year", "Journal", "Study Type", "Domain", "Abstract", "URL"].join(","),
      ...selectedPapers.map(p => [
        `"${p.title}"`,
        `"${p.authors.join("; ")}"`,
        p.year,
        `"${p.journal || ""}"`,
        `"${p.studyType || ""}"`,
        `"${p.domain || ""}"`,
        `"${p.abstract.replace(/"/g, '""')}"`,
        `"${p.url || ""}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-papers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `${selectedCount} paper(s) exported to CSV`,
    });
  };

  const handleAnalyzeSelected = () => {
    if (selectedCount === 0) {
      toast({
        title: "No papers selected",
        description: "Please select papers to analyze",
        variant: "destructive",
      });
      return;
    }

    // Store selected papers in sessionStorage to pass to Index page
    const textsToAnalyze = selectedPapers.map(p => ({
      text: `${p.title}\n\n${p.abstract}${p.fullText ? `\n\n${p.fullText}` : ""}`,
      source: `${p.authors[0]} et al. (${p.year})`,
    }));

    sessionStorage.setItem("researchPapersToAnalyze", JSON.stringify(textsToAnalyze));
    
    toast({
      title: "Redirecting to analysis",
      description: `Preparing ${selectedCount} paper(s) for sentiment analysis`,
    });

    navigate("/?analyze=research");
  };

  const activeFilterCount = 
    (filters.studyTypes.length > 0 ? 1 : 0) +
    (filters.domains.length > 0 ? 1 : 0) +
    (filters.yearMin !== 2015 || filters.yearMax !== new Date().getFullYear() ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Research Paper Library</h1>
              <p className="text-muted-foreground">
                Upload, organize, and analyze research papers for your sentiment analysis
              </p>
            </div>
          </div>

          {/* Project Selector */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Current Project</CardTitle>
              <CardDescription>
                {currentProject 
                  ? `${currentProject.paper_count} papers in this project` 
                  : "Select or create a project to get started"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <ProjectSelector
                  projects={projects}
                  currentProjectId={currentProject?.id}
                  onProjectChange={fetchProjectWithPapers}
                  onCreateNew={() => {
                    setProjectManagerMode('create');
                    setProjectManagerOpen(true);
                  }}
                />
                {currentProject && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setProjectManagerMode('edit');
                      setProjectManagerOpen(true);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {currentProject && currentProject.description && (
                <p className="text-sm text-muted-foreground">
                  {currentProject.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <ResearchFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onClear={handleClearFilters}
            />
            {activeFilterCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              </p>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search and Actions */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Papers in {currentProject?.name || "Project"}
                </CardTitle>
                <CardDescription>
                  Upload PDFs manually or add paper details from Consensus.app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search papers by title, author, or content..."
                      value={filters.searchQuery}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={!currentProject}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Paper
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {filteredPapers.length} paper{filteredPapers.length !== 1 ? "s" : ""} found
                      {papers.length !== filteredPapers.length && ` (${papers.length} total)`}
                    </p>
                    {selectedCount > 0 && (
                      <Badge variant="secondary">
                        {selectedCount} selected
                      </Badge>
                    )}
                  </div>
                  {filteredPapers.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {filteredPapers.every(p => p.selected) ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                </div>

                {selectedCount > 0 && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button onClick={handleAnalyzeSelected} className="flex-1">
                      <FileText className="h-4 w-4 mr-2" />
                      Analyze {selectedCount} Paper{selectedCount > 1 ? "s" : ""}
                    </Button>
                    <Button variant="outline" onClick={handleExportCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteSelected}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Papers List */}
            {papers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No papers yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Start building your research library by uploading PDFs or manually adding paper details from Consensus.app or other sources
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Add Your First Paper
                  </Button>
                </CardContent>
              </Card>
            ) : filteredPapers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No papers match your filters</h3>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your search criteria or filters
                  </p>
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPapers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <PaperUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onPaperAdd={handlePaperAdd}
        />

        <ProjectManager
          open={projectManagerOpen}
          onOpenChange={setProjectManagerOpen}
          mode={projectManagerMode}
          project={projectManagerMode === 'edit' ? currentProject : undefined}
          onSave={async (name, description) => {
            if (projectManagerMode === 'create') {
              const newProject = await createProject(name, description);
              if (newProject) {
                await fetchProjectWithPapers(newProject.id);
              }
            } else if (currentProject) {
              await updateProject(currentProject.id, { name, description });
            }
          }}
          onDelete={currentProject ? () => deleteProject(currentProject.id) : undefined}
        />
      </div>
    </div>
  );
};

export default Research;
