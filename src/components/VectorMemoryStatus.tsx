import { Brain, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmbeddingStatus } from "@/lib/embeddings";

interface VectorMemoryStatusProps {
  status: EmbeddingStatus;
  memoryCount: number;
  isProcessing: boolean;
  onInitialize: () => void;
}

const VectorMemoryStatus = ({
  status,
  memoryCount,
  isProcessing,
  onInitialize,
}: VectorMemoryStatusProps) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs">
      <button
        onClick={onInitialize}
        disabled={status === "loading" || status === "ready"}
        className={cn(
          "flex items-center gap-1.5 transition-colors",
          status === "idle" && "text-muted-foreground hover:text-foreground cursor-pointer",
          status === "loading" && "text-yellow-500",
          status === "ready" && "text-green-500",
          status === "error" && "text-red-500"
        )}
        title={
          status === "idle"
            ? "Click to initialize vector memory"
            : status === "loading"
            ? "Loading embedding model..."
            : status === "ready"
            ? "Vector memory ready"
            : "Error loading model"
        }
      >
        {status === "loading" || isProcessing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : status === "ready" ? (
          <CheckCircle className="w-3.5 h-3.5" />
        ) : status === "error" ? (
          <AlertCircle className="w-3.5 h-3.5" />
        ) : (
          <Brain className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {status === "idle" && "Init Memory"}
          {status === "loading" && "Loading..."}
          {status === "ready" && `${memoryCount} memories`}
          {status === "error" && "Error"}
        </span>
      </button>
    </div>
  );
};

export default VectorMemoryStatus;
