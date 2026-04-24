import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface LeadPaginationHeaderProps {
  startIndex: number;
  endIndex: number;
  totalItems: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export function LeadPaginationHeader({
  startIndex,
  endIndex,
  totalItems,
  pageSize,
  onPageSizeChange,
}: LeadPaginationHeaderProps) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground pb-2 border-b">
      <span>
        Zeige {startIndex + 1} - {Math.min(endIndex, totalItems)} von {totalItems} Anfragen
      </span>
      <div className="flex items-center gap-2">
        <span>Pro Seite:</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface LeadPaginationFooterProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function LeadPaginationFooter({
  currentPage,
  totalPages,
  onPageChange,
}: LeadPaginationFooterProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t">
      <span className="text-sm text-muted-foreground">
        Seite {currentPage} von {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          &laquo;&laquo;
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          &laquo;
        </Button>
        <span className="px-3 py-1 text-sm font-medium">{currentPage}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          &raquo;
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          &raquo;&raquo;
        </Button>
      </div>
    </div>
  );
}
