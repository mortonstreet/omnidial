'use client';

import { Download, CalendarDays, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GoogleSheetsIcon } from '@/components/icons/GoogleSheetsIcon';

export type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DashboardFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
  clientId?: string;
  onClientChange?: (clientId: string | undefined) => void;
  userId?: string;
  onUserChange?: (userId: string | undefined) => void;
  clients?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string | null }>;
  onExport?: () => void;
  onExportToSheets?: () => void;
}

export function DashboardFilters({
  dateRange,
  onDateRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  clientId,
  onClientChange,
  userId,
  onUserChange,
  clients = [],
  users = [],
  onExport,
  onExportToSheets,
}: DashboardFiltersProps) {
  const btnClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition ${
      active
        ? 'bg-card text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date Range Buttons */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        <button onClick={() => onDateRangeChange('today')} className={btnClass(dateRange === 'today')}>
          Today
        </button>
        <button onClick={() => onDateRangeChange('week')} className={btnClass(dateRange === 'week')}>
          This Week
        </button>
        <button onClick={() => onDateRangeChange('month')} className={btnClass(dateRange === 'month')}>
          This Month
        </button>
        <button onClick={() => onDateRangeChange('all')} className={btnClass(dateRange === 'all')}>
          All Time
        </button>
        <button onClick={() => onDateRangeChange('custom')} className={btnClass(dateRange === 'custom')}>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            Custom
          </span>
        </button>
      </div>

      {/* Custom Date Inputs */}
      {dateRange === 'custom' && onCustomDateChange && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customStartDate || ''}
            onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
            className="h-9 px-2.5 text-sm bg-muted/50 border border-border rounded-md text-foreground [color-scheme:dark]"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={customEndDate || ''}
            onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
            className="h-9 px-2.5 text-sm bg-muted/50 border border-border rounded-md text-foreground [color-scheme:dark]"
          />
        </div>
      )}

      {/* Client Filter */}
      {clients.length > 0 && onClientChange && (
        <Select
          value={clientId || 'all'}
          onValueChange={(value) => onClientChange(value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* User/Rep Filter */}
      {users.length > 0 && onUserChange && (
        <Select
          value={userId || 'all'}
          onValueChange={(value) => onUserChange(value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All Reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reps</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Export Dropdown */}
      {(onExport || onExportToSheets) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onExport && (
              <DropdownMenuItem onClick={onExport}>
                <FileText className="w-4 h-4 mr-2" />
                CSV
              </DropdownMenuItem>
            )}
            {onExportToSheets && (
              <DropdownMenuItem onClick={onExportToSheets}>
                <GoogleSheetsIcon className="w-4 h-4 mr-2" />
                Google Sheets
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
