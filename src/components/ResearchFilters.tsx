import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STUDY_TYPES, DOMAINS, ResearchFilters } from "@/types/consensus";

interface ResearchFiltersProps {
  filters: ResearchFilters;
  onFiltersChange: (filters: ResearchFilters) => void;
  onClear: () => void;
}

export const ResearchFiltersComponent = ({ filters, onFiltersChange, onClear }: ResearchFiltersProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear All
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-3 block">
            Year Range: {filters.yearMin} - {filters.yearMax}
          </Label>
          <Slider
            min={2000}
            max={currentYear}
            step={1}
            value={[filters.yearMin, filters.yearMax]}
            onValueChange={([min, max]) => 
              onFiltersChange({ ...filters, yearMin: min, yearMax: max })
            }
            className="w-full"
          />
        </div>

        <div>
          <Label className="mb-3 block">Study Type</Label>
          <div className="space-y-2">
            {STUDY_TYPES.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`study-${type}`}
                  checked={filters.studyTypes.includes(type)}
                  onCheckedChange={(checked) => {
                    const newTypes = checked
                      ? [...filters.studyTypes, type]
                      : filters.studyTypes.filter((t) => t !== type);
                    onFiltersChange({ ...filters, studyTypes: newTypes });
                  }}
                />
                <label
                  htmlFor={`study-${type}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {type}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Domain</Label>
          <div className="space-y-2">
            {DOMAINS.map((domain) => (
              <div key={domain} className="flex items-center space-x-2">
                <Checkbox
                  id={`domain-${domain}`}
                  checked={filters.domains.includes(domain)}
                  onCheckedChange={(checked) => {
                    const newDomains = checked
                      ? [...filters.domains, domain]
                      : filters.domains.filter((d) => d !== domain);
                    onFiltersChange({ ...filters, domains: newDomains });
                  }}
                />
                <label
                  htmlFor={`domain-${domain}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {domain}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
