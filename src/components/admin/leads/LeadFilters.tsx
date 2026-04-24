import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Download, Ban } from "lucide-react";

interface LeadFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (filter: string) => void;
  blacklistCount: number;
  onExportCSV: () => void;
  onOpenBlacklist: () => void;
}

export function LeadFilters({
  searchQuery,
  onSearchChange,
  serviceFilter,
  onServiceFilterChange,
  blacklistCount,
  onExportCSV,
  onOpenBlacklist,
}: LeadFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Suchen nach Name, E-Mail, Telefon..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={serviceFilter} onValueChange={onServiceFilterChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Service filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Services</SelectItem>
            <SelectItem value="umzug_privat">Privatumzug</SelectItem>
            <SelectItem value="umzug_firma">Firmenumzug</SelectItem>
            <SelectItem value="reinigung_end">Endreinigung</SelectItem>
            <SelectItem value="reinigung_grund">Grundreinigung</SelectItem>
            <SelectItem value="raeumung_wohnung">Wohnungsräumung</SelectItem>
            <SelectItem value="entsorgung">Entsorgung</SelectItem>
            <SelectItem value="lagerung">Lagerung</SelectItem>
            <SelectItem value="klaviertransport">Klaviertransport</SelectItem>
            <SelectItem value="moebellift">Möbellift</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportCSV} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 mr-2" />
            CSV Export
          </Button>
          <Button variant="outline" onClick={onOpenBlacklist} className="flex-1 sm:flex-none">
            <Ban className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">IP-Blacklist</span>
            <span className="sm:hidden">Blacklist</span>
            <span className="ml-1">({blacklistCount})</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
