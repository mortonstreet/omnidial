"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadCsv } from "@/hooks/api/useCampaigns";
import { toast } from "sonner";

interface CsvUploaderProps {
  campaignId: string;
  onSuccess?: () => void;
}

export function CsvUploader({ campaignId, onSuccess }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const uploadMutation = useUploadCsv();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      setFile(droppedFile);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
      }
    },
    []
  );

  const handleUpload = async () => {
    if (!file) return;

    try {
      await uploadMutation.mutateAsync({ campaignId, file });
      toast.success("CSV upload started! Leads will be imported in the background.");
      setFile(null);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload CSV"
      );
    }
  };

  const handleClear = () => {
    setFile(null);
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }
        `}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadMutation.isPending}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                handleClear();
              }}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-medium mb-1">
              Drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </>
        )}
      </div>

      {file && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </>
            )}
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <p className="font-medium mb-1">Required column:</p>
        <p>phone - Phone number (any format)</p>
        <p className="font-medium mt-2 mb-1">Optional columns:</p>
        <p>
          first_name, last_name, email, company, title, linkedin_url, website
        </p>
        <p className="mt-1">
          Any additional columns will be stored as custom fields.
        </p>
      </div>
    </div>
  );
}
