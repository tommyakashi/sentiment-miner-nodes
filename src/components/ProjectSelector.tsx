import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResearchProject } from '@/types/project';
import { Plus } from 'lucide-react';

interface ProjectSelectorProps {
  projects: ResearchProject[];
  currentProjectId?: string;
  onProjectChange: (projectId: string) => void;
  onCreateNew: () => void;
}

export const ProjectSelector = ({
  projects,
  currentProjectId,
  onProjectChange,
  onCreateNew,
}: ProjectSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={currentProjectId} onValueChange={onProjectChange}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onCreateNew} variant="outline" size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};
