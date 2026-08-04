'use client';

import { useState } from 'react';
import { CallsLogTab } from './CallsLogTab';
import { RecordingsLogTab } from './RecordingsLogTab';
import { TranscriptionsLogTab } from './TranscriptionsLogTab';
import { ErrorLogsTab } from './ErrorLogsTab';
import { ActivityLogTab } from './ActivityLogTab';

type SubTab = 'calls' | 'recordings' | 'transcriptions' | 'errors' | 'activity';

const subTabs: { id: SubTab; label: string }[] = [
  { id: 'calls', label: 'Calls' },
  { id: 'recordings', label: 'Recordings' },
  { id: 'transcriptions', label: 'Transcriptions' },
  { id: 'errors', label: 'Errors' },
  { id: 'activity', label: 'Activity' },
];

export function LogsTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('calls');

  return (
    <div>
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 mb-6">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition ${
              activeSubTab === tab.id
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'calls' && <CallsLogTab />}
      {activeSubTab === 'recordings' && <RecordingsLogTab />}
      {activeSubTab === 'transcriptions' && <TranscriptionsLogTab />}
      {activeSubTab === 'errors' && <ErrorLogsTab />}
      {activeSubTab === 'activity' && <ActivityLogTab />}
    </div>
  );
}
