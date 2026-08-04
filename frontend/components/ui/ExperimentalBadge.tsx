import { FlaskConical } from "lucide-react";

export function ExperimentalBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
      <FlaskConical className="w-3 h-3" />
      Experimental
    </span>
  );
}
