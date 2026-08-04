"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Phone,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Zap,
  Hash,
  MapPin,
  ServerCog,
} from "lucide-react";
import {
  usePhoneProvisioningStatus,
  useSearchAvailableNumbers,
  useSetupInfrastructure,
  useProvisionPhoneNumber,
  useProvisionQuickNumber,
  useVerifyCallerId,
  useCallerIdVerificationStatus,
} from "@/hooks/api/usePhoneProvisioning";
import type { AvailablePhoneNumber } from "@shared/types/src";

function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// ─── State: Main Account ─────────────────────────────────────
function MainAccountState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Phone System
        </CardTitle>
        <CardDescription>
          This organization uses the master Twilio account. Phone numbers are
          managed by the system administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Connected to master Twilio account</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── State: No Infrastructure ────────────────────────────────
function NoInfrastructureState() {
  const setupInfra = useSetupInfrastructure();

  const handleSetup = () => {
    setupInfra.mutate(undefined, {
      onSuccess: () => {
        toast.success("Phone system infrastructure created successfully.");
      },
      onError: (err) => {
        toast.error("Failed to set up phone system: " + err.message);
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-muted-foreground" />
          Set Up Phone System
        </CardTitle>
        <CardDescription>
          Initialize your organization&apos;s phone infrastructure to get started
          with calls. This creates a dedicated phone environment for your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="lg"
          onClick={handleSetup}
          disabled={setupInfra.isPending}
        >
          {setupInfra.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ServerCog className="h-4 w-4" />
          )}
          {setupInfra.isPending ? "Setting up..." : "Set Up Phone System"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── State: Awaiting Number ──────────────────────────────────
function AwaitingNumberState() {
  const provisionQuick = useProvisionQuickNumber();
  const provisionSelected = useProvisionPhoneNumber();
  const [areaCode, setAreaCode] = useState("");
  const [selectedNumber, setSelectedNumber] =
    useState<AvailablePhoneNumber | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const searchEnabled = areaCode.length === 3 && /^\d{3}$/.test(areaCode);
  const { data: searchData, isLoading: searchLoading } =
    useSearchAvailableNumbers(areaCode, searchEnabled);

  const handleQuickSetup = () => {
    provisionQuick.mutate(undefined, {
      onSuccess: () => {
        toast.success("Phone number activated!");
      },
      onError: (err) => {
        toast.error("Failed to get a number: " + err.message);
      },
    });
  };

  const handleConfirmProvision = () => {
    if (!selectedNumber) return;
    provisionSelected.mutate(selectedNumber.phoneNumber, {
      onSuccess: () => {
        toast.success("Phone number provisioned successfully!");
        setConfirmDialogOpen(false);
        setSelectedNumber(null);
        setAreaCode("");
      },
      onError: (err) => {
        toast.error("Failed to provision number: " + err.message);
        setConfirmDialogOpen(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Two acquisition paths side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Path A: Quick Setup */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Setup
            </CardTitle>
            <CardDescription>
              Get a phone number instantly. We&apos;ll pick an available number
              for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleQuickSetup}
              disabled={provisionQuick.isPending || provisionSelected.isPending}
              className="w-full"
              size="lg"
            >
              {provisionQuick.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {provisionQuick.isPending
                ? "Getting your number..."
                : "Get a Number Automatically"}
            </Button>
          </CardContent>
        </Card>

        {/* Path B: Choose Your Number */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-primary" />
              Choose Your Number
            </CardTitle>
            <CardDescription>
              Search by area code and pick the exact number you want.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Area code (e.g. 212)"
                  maxLength={3}
                  value={areaCode}
                  onChange={(e) =>
                    setAreaCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="pr-8"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                disabled={!searchEnabled || searchLoading}
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search results */}
      {searchLoading && searchEnabled && (
        <Card>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <div className="ml-auto">
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {searchData?.data && searchData.data.length > 0 && !searchLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Available Numbers ({searchData.data.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left border-b">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {searchData.data.map((number) => (
                    <tr
                      key={number.phoneNumber}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">
                          {formatPhoneNumber(number.phoneNumber)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(number.locality || number.region) && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {[number.locality, number.region]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={provisionSelected.isPending}
                          onClick={() => {
                            setSelectedNumber(number);
                            setConfirmDialogOpen(true);
                          }}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {searchData?.data &&
        searchData.data.length === 0 &&
        !searchLoading &&
        searchEnabled && (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No numbers available for area code{" "}
                  <span className="font-mono font-medium">{areaCode}</span>.
                  Try a different area code.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Confirmation dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to provision{" "}
              <span className="font-semibold font-mono">
                {formatPhoneNumber(selectedNumber?.phoneNumber)}
              </span>{" "}
              as your organization&apos;s phone number.
              {selectedNumber?.locality && (
                <>
                  {" "}
                  This number is located in{" "}
                  <span className="font-medium">
                    {[selectedNumber.locality, selectedNumber.region]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  .
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmProvision}
              disabled={provisionSelected.isPending}
            >
              {provisionSelected.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── State: Provisioning ─────────────────────────────────────
function ProvisioningState() {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Activating your phone number...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── State: Active ───────────────────────────────────────────
function ActiveState({
  phoneNumber,
  callerIdVerified,
}: {
  phoneNumber: string;
  callerIdVerified: boolean;
}) {
  const verifyCaller = useVerifyCallerId();
  const { data: verificationData } = useCallerIdVerificationStatus();

  const isVerified =
    callerIdVerified || verificationData?.data?.callerIdVerified;

  const handleVerifyCallerId = () => {
    verifyCaller.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(
          `Verification call initiated. Your code is: ${data.data.validationCode}`
        );
      },
      onError: (err) => {
        toast.error("Failed to verify: " + err.message);
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-500" />
          Your Phone Number
        </CardTitle>
        <CardDescription>
          Your phone number is active and ready for calls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Phone className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold font-mono tracking-tight">
                {formatPhoneNumber(phoneNumber)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="text-green-500 border-green-500/30"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
                {isVerified ? (
                  <Badge
                    variant="outline"
                    className="text-green-500 border-green-500/30"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-yellow-500 border-yellow-500/30"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isVerified && (
          <div className="mt-4">
            <Button
              onClick={handleVerifyCallerId}
              disabled={verifyCaller.isPending}
              variant="outline"
            >
              {verifyCaller.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Verify Caller ID
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Twilio will call your number with a verification code.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function PhoneNumberSetup() {
  const { data: statusData, isLoading: statusLoading } =
    usePhoneProvisioningStatus();

  const provisioning = statusData?.data;

  // Loading
  if (statusLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading phone settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State: Main Account
  if (provisioning?.usesMainAccount) {
    return <MainAccountState />;
  }

  // State: Active (has phone number)
  if (
    provisioning?.provisioningStatus === "active" &&
    provisioning?.phoneNumber
  ) {
    return (
      <ActiveState
        phoneNumber={provisioning.phoneNumber}
        callerIdVerified={provisioning.callerIdVerified}
      />
    );
  }

  // State: Provisioning
  if (provisioning?.provisioningStatus === "provisioning") {
    return <ProvisioningState />;
  }

  // State: Awaiting Number (infrastructure ready, needs number selection)
  if (provisioning?.hasInfrastructure) {
    return <AwaitingNumberState />;
  }

  // State: No Infrastructure (no record, setup_pending, failed, or no infra)
  return <NoInfrastructureState />;
}
