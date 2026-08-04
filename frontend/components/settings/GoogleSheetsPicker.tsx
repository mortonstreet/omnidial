"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useGoogleSheets } from "@/hooks/api/useIntegrations";
import { GoogleSheet } from "@shared/types/src";
import { FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

interface GoogleSheetsPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sheet: GoogleSheet) => void;
}

export function GoogleSheetsPicker({
  isOpen,
  onClose,
  onSelect,
}: GoogleSheetsPickerProps) {
  const { data, isLoading, refetch, isRefetching } = useGoogleSheets();
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);

  const sheets = data?.data || [];

  const handleSelect = () => {
    if (selectedSheet) {
      onSelect(selectedSheet);
      setSelectedSheet(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Google Sheet"
      subtitle="Choose a spreadsheet to import leads from"
    >
      <div className="space-y-4">
        {/* Sheets list */}
        <div className="relative rounded-lg border border-border overflow-hidden">
          {/* Refresh button - positioned inside the list header */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
            <span className="text-sm text-muted-foreground">
              {sheets.length} {sheets.length === 1 ? "spreadsheet" : "spreadsheets"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-8 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Scrollable list area */}
          <div className="max-h-[320px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sheets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No spreadsheets found</p>
                <p className="text-sm">Create a spreadsheet in Google Sheets first</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    onClick={() => setSelectedSheet(sheet)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      selectedSheet?.id === sheet.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-1 self-stretch rounded-full transition-colors ${
                        selectedSheet?.id === sheet.id ? "bg-primary" : "bg-transparent"
                      }`}
                    />
                    <FileSpreadsheet className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {sheet.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Modified {formatDate(sheet.modifiedTime)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedSheet}>
            Select Sheet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
