import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, SortAsc, SortDesc } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  sortDirection: 'asc' | 'desc';
  onSortDirectionChange: () => void;
  fileType: string;
  onFileTypeChange: (value: string) => void;
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  sortDirection,
  onSortDirectionChange,
  fileType,
  onFileTypeChange,
}: SearchBarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <div className="flex gap-2 w-full md:w-auto">
        <Select value={fileType} onValueChange={onFileTypeChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="File type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All files</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="tsv">TSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={onSortDirectionChange}
        >
          {sortDirection === 'asc' ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
