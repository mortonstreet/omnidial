"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHubSpotContactsSummary, useImportFromHubSpot } from "@/hooks/api/useIntegrations";
import { Loader2, Users, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

interface HubSpotContactImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (listId: string, listName: string, leadsImported: number) => void;
}

export function HubSpotContactImporter({
  isOpen,
  onClose,
  onSuccess,
}: HubSpotContactImporterProps) {
  const [listName, setListName] = useState("");
  const [maxContacts, setMaxContacts] = useState("");
  const [requirePhone, setRequirePhone] = useState(true);

  const { data, isLoading, refetch } = useHubSpotContactsSummary(isOpen);
  const importMutation = useImportFromHubSpot();

  const summary = data?.data;

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({
        listName: listName || undefined,
        requirePhone,
        maxContacts: maxContacts ? parseInt(maxContacts, 10) : undefined,
      });

      if (result.data) {
        onSuccess(result.data.listId, result.data.listName, result.data.leadsImported);
        handleClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import contacts"
      );
    }
  };

  const handleClose = () => {
    setListName("");
    setMaxContacts("");
    setRequirePhone(true);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import from HubSpot"
      subtitle="Preview and import your HubSpot contacts as leads"
    >
      <div className="space-y-4">
        {/* Summary */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading contacts preview...</span>
          </div>
        ) : summary ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{summary.totalContacts}</p>
              <p className="text-xs text-muted-foreground">Total Contacts</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Phone className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{summary.contactsWithPhone}</p>
              <p className="text-xs text-muted-foreground">With Phone</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{summary.contactsWithEmail}</p>
              <p className="text-xs text-muted-foreground">With Email</p>
            </div>
          </div>
        ) : null}

        {/* Sample contacts preview */}
        {summary && summary.sampleContacts.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Sample Contacts</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Company</th>
                    <th className="text-left p-2 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sampleContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-border last:border-0">
                      <td className="p-2 truncate max-w-[140px]">
                        {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="p-2 truncate max-w-[120px] text-muted-foreground">
                        {contact.company || "-"}
                      </td>
                      <td className="p-2 truncate max-w-[120px] text-muted-foreground">
                        {contact.phone || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              List Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={`HubSpot Import ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Max Contacts <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              type="number"
              value={maxContacts}
              onChange={(e) => setMaxContacts(e.target.value)}
              placeholder="All contacts"
              min={1}
              max={10000}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requirePhone}
              onChange={(e) => setRequirePhone(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-foreground cursor-pointer"
            />
            <span className="text-sm">Only import contacts with a phone number</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending || isLoading}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              "Import Contacts"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
