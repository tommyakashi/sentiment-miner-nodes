import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResearchProject, ProjectPaper, ProjectWithPapers } from '@/types/project';
import { ResearchPaper } from '@/types/consensus';
import { useToast } from '@/hooks/use-toast';

export const useResearchProject = () => {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectWithPapers | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch all projects for the current user
  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data?.map(p => ({
        ...p,
        created_at: new Date(p.created_at),
        updated_at: new Date(p.updated_at),
      })) || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    }
  };

  // Fetch a specific project with its papers
  const fetchProjectWithPapers = async (projectId: string) => {
    setIsLoading(true);
    try {
      const [projectRes, papersRes] = await Promise.all([
        supabase
          .from('research_projects')
          .select('*')
          .eq('id', projectId)
          .single(),
        supabase
          .from('project_papers')
          .select('*')
          .eq('project_id', projectId)
          .order('added_at', { ascending: false }),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (papersRes.error) throw papersRes.error;

      const projectWithPapers: ProjectWithPapers = {
        ...projectRes.data,
        created_at: new Date(projectRes.data.created_at),
        updated_at: new Date(projectRes.data.updated_at),
        papers: papersRes.data?.map(p => ({
          ...p,
          paper_data: p.paper_data as any as ResearchPaper,
          added_at: new Date(p.added_at),
        })) || [],
        paper_count: papersRes.data?.length || 0,
      };

      setCurrentProject(projectWithPapers);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new project
  const createProject = async (name: string, description?: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('research_projects')
        .insert([{ name, description, user_id: userData.user.id }])
        .select()
        .single();

      if (error) throw error;

      await fetchProjects();
      toast({
        title: 'Success',
        description: 'Project created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Update project
  const updateProject = async (projectId: string, updates: { name?: string; description?: string }) => {
    try {
      const { error } = await supabase
        .from('research_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      if (currentProject?.id === projectId) {
        await fetchProjectWithPapers(projectId);
      }

      toast({
        title: 'Success',
        description: 'Project updated successfully',
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      });
    }
  };

  // Delete project
  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('research_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }

      toast({
        title: 'Success',
        description: 'Project deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  // Add paper to project
  const addPaperToProject = async (projectId: string, paper: ResearchPaper) => {
    try {
      const { error } = await supabase
        .from('project_papers')
        .insert([{ project_id: projectId, paper_data: paper as any }]);

      if (error) throw error;

      await fetchProjectWithPapers(projectId);
      toast({
        title: 'Success',
        description: 'Paper added to project',
      });
    } catch (error) {
      console.error('Error adding paper:', error);
      toast({
        title: 'Error',
        description: 'Failed to add paper to project',
        variant: 'destructive',
      });
    }
  };

  // Add multiple papers to project
  const addPapersToProject = async (projectId: string, papers: ResearchPaper[]) => {
    try {
      const inserts = papers.map((paper) => ({
        project_id: projectId,
        paper_data: paper as any,
      }));

      const { error } = await supabase.from('project_papers').insert(inserts);

      if (error) throw error;

      await fetchProjectWithPapers(projectId);
      toast({
        title: 'Success',
        description: `${papers.length} papers added to project`,
      });
    } catch (error) {
      console.error('Error adding papers:', error);
      toast({
        title: 'Error',
        description: 'Failed to add papers to project',
        variant: 'destructive',
      });
    }
  };

  // Remove paper from project
  const removePaperFromProject = async (paperId: string) => {
    try {
      const { error } = await supabase
        .from('project_papers')
        .delete()
        .eq('id', paperId);

      if (error) throw error;

      if (currentProject) {
        await fetchProjectWithPapers(currentProject.id);
      }

      toast({
        title: 'Success',
        description: 'Paper removed from project',
      });
    } catch (error) {
      console.error('Error removing paper:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove paper',
        variant: 'destructive',
      });
    }
  };

  // Remove multiple papers from project
  const removePapersFromProject = async (paperIds: string[]) => {
    try {
      const { error } = await supabase
        .from('project_papers')
        .delete()
        .in('id', paperIds);

      if (error) throw error;

      if (currentProject) {
        await fetchProjectWithPapers(currentProject.id);
      }

      toast({
        title: 'Success',
        description: `${paperIds.length} papers removed from project`,
      });
    } catch (error) {
      console.error('Error removing papers:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove papers',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    currentProject,
    isLoading,
    fetchProjects,
    fetchProjectWithPapers,
    createProject,
    updateProject,
    deleteProject,
    addPaperToProject,
    addPapersToProject,
    removePaperFromProject,
    removePapersFromProject,
    setCurrentProject,
  };
};
