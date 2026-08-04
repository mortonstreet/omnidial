"use client";

import { useState, useMemo } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  useGoogleSheetColumns,
  useImportFromGoogleSheet,
} from "@/hooks/api/useIntegrations";
import { GoogleSheet, ColumnMappingInput } from "@shared/types/src";
import { Loader2, FileSpreadsheet, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: GoogleSheet | null;
  onSuccess: (listId: string, listName: string, leadsImported: number) => void;
}

const LEAD_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "phone", label: "Phone (required)" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "title", label: "Title" },
  { value: "linkedInUrl", label: "LinkedIn URL" },
];

export function ColumnMappingModal({
  isOpen,
  onClose,
  sheet,
  onSuccess,
}: ColumnMappingModalProps) {
  const { data: columnsData, isLoading: isLoadingColumns } = useGoogleSheetColumns(
    sheet?.id
  );
  const importMutation = useImportFromGoogleSheet();

  const [mappings, setMappings] = useState<Record<number, string>>({});
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<{
    listId: string;
    listName: string;
    leadsImported: number;
  } | null>(null);

  // Track state for resetting and auto-mapping (React recommended pattern)
  const [prevSheetId, setPrevSheetId] = useState<string | undefined>(sheet?.id);
  const [autoMappedForSheet, setAutoMappedForSheet] = useState<string | undefined>(undefined);

  // Memoize columns to avoid dependency issues
  const columns = useMemo(() => columnsData?.data || [], [columnsData?.data]);

  // Reset state when modal opens with new sheet (adjusting state during render)
  if (isOpen && sheet?.id !== prevSheetId) {
    setPrevSheetId(sheet?.id);
    setMappings({});
    setImportComplete(false);
    setImportResult(null);
    setAutoMappedForSheet(undefined);
  }

  // Compute auto-mappings from columns
  const autoMappings = useMemo(() => {
    const result: Record<number, string> = {};
    columns.forEach((col) => {
      const name = col.name.toLowerCase().trim();

      if (name.includes("first") && name.includes("name")) {
        result[col.index] = "firstName";
      } else if (name.includes("last") && name.includes("name")) {
        result[col.index] = "lastName";
      } else if (name === "phone" || name.includes("phone number")) {
        result[col.index] = "phone";
      } else if (name === "email" || name.includes("email address")) {
        result[col.index] = "email";
      } else if (name === "company" || name.includes("company name")) {
        result[col.index] = "company";
      } else if (name === "title" || name.includes("job title")) {
        result[col.index] = "title";
      } else if (name.includes("linkedin")) {
        result[col.index] = "linkedInUrl";
      }
    });
    return result;
  }, [columns]);

  // Apply auto-mappings once per sheet (adjusting state during render)
  if (
    columns.length > 0 &&
    Object.keys(autoMappings).length > 0 &&
    Object.keys(mappings).length === 0 &&
    autoMappedForSheet !== sheet?.id
  ) {
    setAutoMappedForSheet(sheet?.id);
    setMappings(autoMappings);
  }

  const handleMappingChange = (columnIndex: number, leadField: string) => {
    setMappings((prev) => {
      const updated = { ...prev };
      if (leadField === "") {
        delete updated[columnIndex];
      } else {
        updated[columnIndex] = leadField;
      }
      return updated;
    });
  };

  const hasPhoneMapping = Object.values(mappings).includes("phone");

  const handleImport = async () => {
    if (!sheet || !hasPhoneMapping) return;

    const columnMappings: ColumnMappingInput[] = Object.entries(mappings).map(
      ([index, field]) => ({
        columnIndex: parseInt(index),
        columnName: columns.find((c) => c.index === parseInt(index))?.name || "",
        leadField: field,
      })
    );

    try {
      const result = await importMutation.mutateAsync({
        sheetId: sheet.id,
        columnMappings,
        listName: sheet.name,
      });

      if (result.data.success) {
        setImportResult({
          listId: result.data.listId,
          listName: result.data.listName,
          leadsImported: result.data.leadsImported,
        });
        setImportComplete(true);
        toast.success(`Imported ${result.data.leadsImported} leads`);
      }
    } catch {
      toast.error("Failed to import leads");
    }
  };

  const handleDone = () => {
    if (importResult) {
      onSuccess(importResult.listId, importResult.listName, importResult.leadsImported);
    }
    onClose();
  };

  if (!sheet) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={importComplete ? "Import Complete" : "Map Columns"}
      subtitle={
        importComplete
          ? "Your leads have been imported successfully"
          : `Map columns from "${sheet.name}" to lead fields`
      }
    >
      <div className="space-y-4">
        {importComplete && importResult ? (
          // Success state
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {importResult.leadsImported} Leads Imported
            </h3>
            <p className="text-muted-foreground mb-6">
              Created list: <strong>{importResult.listName}</strong>
            </p>
            <Button onClick={handleDone}>Done</Button>
          </div>
        ) : isLoadingColumns ? (
          // Loading state
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : columns.length === 0 ? (
          // No columns found
          <div className="text-center py-12 text-muted-foreground">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No columns found in this spreadsheet</p>
            <p className="text-sm">Make sure your spreadsheet has a header row</p>
          </div>
        ) : (
          // Mapping interface
          <>
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              Map your spreadsheet columns to lead fields. The <strong>Phone</strong>{" "}
              field is required.
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-3">
              {columns.map((column) => (
                <div
                  key={column.index}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{column.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Column {column.index + 1}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                  <select
                    value={mappings[column.index] || ""}
                    onChange={(e) => handleMappingChange(column.index, e.target.value)}
                    className="w-40 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {LEAD_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!hasPhoneMapping && (
              <p className="text-sm text-amber-600">
                Please map a column to the Phone field to continue
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!hasPhoneMapping || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Leads"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
