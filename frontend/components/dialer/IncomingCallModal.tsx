"use client";

import { Phone, PhoneOff, User } from "lucide-react";

interface IncomingCallModalProps {
  callerNumber: string;
  callerName?: string;
  callerCompany?: string;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({
  callerNumber,
  callerName,
  callerCompany,
  onAnswer,
  onDecline,
}: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-in fade-in">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 border border-border shadow-xl animate-in zoom-in-95">
        {/* Caller info */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <User className="w-10 h-10 text-primary" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-green-500 animate-bounce" />
            <span className="text-sm font-medium text-green-500">Incoming Call</span>
          </div>

          {callerName ? (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {callerName}
              </h2>
              {callerCompany && (
                <p className="text-muted-foreground">{callerCompany}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">{callerNumber}</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Unknown Caller
              </h2>
              <p className="text-muted-foreground">{callerNumber}</p>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={onDecline}
            className="p-5 bg-red-500 hover:bg-red-600 text-white rounded-full transition shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          <button
            onClick={onAnswer}
            className="p-5 bg-green-500 hover:bg-green-600 text-white rounded-full transition shadow-lg shadow-green-500/30 animate-pulse"
          >
            <Phone className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
