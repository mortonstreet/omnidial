"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GoogleSheetsIcon } from "@/components/icons/GoogleSheetsIcon";
import { GoogleSheetsPicker } from "@/components/settings/GoogleSheetsPicker";
import {
  useCheckSheetsWriteAccess,
  useConnectIntegration,
  useExportLeadsToSheet,
  useExportListToSheet,
  useExportAnalyticsToSheet,
  useIntegrations,
} from "@/hooks/api/useIntegrations";
import { GoogleSheet, ExportTarget } from "@shared/types/src";
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataType: "leads" | "list" | "analytics";
  leadIds?: string[];
  listId?: string;
  listName?: string;
  dateRange?: { start: string; end: string };
}

type ExportState =
  | "checking"
  | "not_connected"
  | "needs_reauth"
  | "ready"
  | "exporting"
  | "success";

export function GoogleSheetsExportModal({
  isOpen,
  onClose,
  dataType,
  leadIds,
  listId,
  listName,
  dateRange,
}: GoogleSheetsExportModalProps) {
  const [exportState, setExportState] = useState<ExportState>("checking");
  const [target, setTarget] = useState<ExportTarget>("new_sheet");
  const [newSheetTitle, setNewSheetTitle] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [exportResult, setExportResult] = useState<{
    url: string;
    name: string;
    rows: number;
  } | null>(null);

  const { data: integrationsData } = useIntegrations();
  const { data: writeAccessData, isLoading: isCheckingAccess } =
    useCheckSheetsWriteAccess();
  const connectMutation = useConnectIntegration();
  const exportLeadsMutation = useExportLeadsToSheet();
  const exportListMutation = useExportListToSheet();
  const exportAnalyticsMutation = useExportAnalyticsToSheet();

  const isExporting =
    exportLeadsMutation.isPending ||
    exportListMutation.isPending ||
    exportAnalyticsMutation.isPending;

  // Compute default sheet title based on data type
  const defaultSheetTitle = (() => {
    if (dataType === "list" && listName) {
      return listName;
    } else if (dataType === "analytics" && dateRange) {
      return `Analytics ${dateRange.start} to ${dateRange.end}`;
    } else if (dataType === "leads") {
      return `Exported Leads - ${new Date().toLocaleDateString()}`;
    }
    return "";
  })();

  // Compute export state based on integration status
  const computedExportState = (() => {
    if (!isOpen) return "checking";

    const integrations = integrationsData?.data || [];
    const sheetsIntegration = integrations.find(
      (i) => i.provider === "google_sheets"
    );

    if (!sheetsIntegration?.isConnected) {
      return "not_connected";
    }

    if (isCheckingAccess) {
      return "checking";
    }

    if (writeAccessData?.data) {
      if (writeAccessData.data.hasWriteAccess) {
        return "ready";
      } else if (writeAccessData.data.needsReauth) {
        return "needs_reauth";
      }
    }

    return "checking";
  })();

  // Sync computed state to actual state (only when modal opens or status changes)
  useEffect(() => {
    if (!isOpen) {
      // Defer state reset to avoid cascading renders
      const timeoutId = setTimeout(() => {
        setExportState("checking");
        setTarget("new_sheet");
        setNewSheetTitle("");
        setSelectedSheet(null);
        setExportResult(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // Only update if we haven't started exporting
    if (exportState !== "exporting" && exportState !== "success") {
      // Batch updates via setTimeout to avoid cascading renders
      const timeoutId = setTimeout(() => {
        setExportState(computedExportState);
        if (!newSheetTitle) {
          setNewSheetTitle(defaultSheetTitle);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, computedExportState, defaultSheetTitle, exportState, newSheetTitle]);

  const handleConnect = () => {
    connectMutation.mutate("google_sheets", {
      onSuccess: (data) => {
        if (data?.data?.url) {
          window.location.href = data.data.url;
        }
      },
      onError: () => {
        toast.error("Failed to initiate connection");
      },
    });
  };

  const handleExport = async () => {
    if (target === "existing_sheet" && !selectedSheet) {
      toast.error("Please select a spreadsheet");
      return;
    }

    if (target === "new_sheet" && !newSheetTitle.trim()) {
      toast.error("Please enter a title for the new spreadsheet");
      return;
    }

    setExportState("exporting");

    const exportParams = {
      target,
      existingSheetId: target === "existing_sheet" ? selectedSheet?.id : undefined,
      newSheetTitle: target === "new_sheet" ? newSheetTitle.trim() : undefined,
    };

    try {
      let result;

      if (dataType === "leads" && leadIds) {
        result = await exportLeadsMutation.mutateAsync({
          leadIds,
          ...exportParams,
        });
      } else if (dataType === "list" && listId) {
        result = await exportListMutation.mutateAsync({
          listId,
          ...exportParams,
        });
      } else if (dataType === "analytics" && dateRange) {
        result = await exportAnalyticsMutation.mutateAsync({
          dateRange,
          ...exportParams,
        });
      }

      if (result?.data) {
        setExportResult({
          url: result.data.spreadsheetUrl,
          name: result.data.spreadsheetName,
          rows: result.data.rowsExported,
        });
        setExportState("success");
        toast.success("Export completed!");
      }
    } catch (error) {
      setExportState("ready");
      toast.error(
        error instanceof Error ? error.message : "Export failed"
      );
    }
  };

  const handleSheetSelect = (sheet: GoogleSheet) => {
    setSelectedSheet(sheet);
    setShowSheetPicker(false);
  };

  const getTitle = () => {
    switch (dataType) {
      case "leads":
        return "Export Leads to Google Sheets";
      case "list":
        return "Export List to Google Sheets";
      case "analytics":
        return "Export Analytics to Google Sheets";
      default:
        return "Export to Google Sheets";
    }
  };

  const renderContent = () => {
    switch (exportState) {
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Checking access...</p>
          </div>
        );

      case "not_connected":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <GoogleSheetsIcon className="w-12 h-12 mb-4" />
            <h3 className="font-medium text-lg mb-2">
              Connect Google Account
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Sign in with Google to allow exporting data to your spreadsheets.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <GoogleSheetsIcon className="w-4 h-4 mr-2" />
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        );

      case "needs_reauth":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <GoogleSheetsIcon className="w-12 h-12 mb-4" />
            <h3 className="font-medium text-lg mb-2">
              Connect Google Account
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Sign in with Google to allow exporting data to your spreadsheets.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <GoogleSheetsIcon className="w-4 h-4 mr-2" />
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        );

      case "ready":
        return (
          <div className="space-y-6">
            <RadioGroup
              value={target}
              onValueChange={(value) => setTarget(value as ExportTarget)}
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition cursor-pointer">
                <RadioGroupItem value="new_sheet" id="new_sheet" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="new_sheet" className="cursor-pointer font-medium">
                    Create new spreadsheet
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Create a new Google Sheet with your exported data
                  </p>
                  {target === "new_sheet" && (
                    <div className="mt-3">
                      <Input
                        placeholder="Spreadsheet title"
                        value={newSheetTitle}
                        onChange={(e) => setNewSheetTitle(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition cursor-pointer">
                <RadioGroupItem
                  value="existing_sheet"
                  id="existing_sheet"
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="existing_sheet"
                    className="cursor-pointer font-medium"
                  >
                    Export to existing spreadsheet
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Add data to an existing Google Sheet (replaces Sheet1)
                  </p>
                  {target === "existing_sheet" && (
                    <div className="mt-3">
                      {selectedSheet ? (
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-green-500" />
                            <span className="font-medium">
                              {selectedSheet.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSheetPicker(true)}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setShowSheetPicker(true)}
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Select Spreadsheet
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <GoogleSheetsIcon className="w-4 h-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "exporting":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Exporting data...</p>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="font-medium text-lg mb-2">Export Complete!</h3>
            <p className="text-muted-foreground text-center mb-2">
              {exportResult?.rows} rows exported to{" "}
              <span className="font-medium">{exportResult?.name}</span>
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button asChild>
                <a
                  href={exportResult?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Google Sheets
                </a>
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
        {renderContent()}
      </Modal>

      <GoogleSheetsPicker
        isOpen={showSheetPicker}
        onClose={() => setShowSheetPicker(false)}
        onSelect={handleSheetSelect}
      />
    </>
  );
}
