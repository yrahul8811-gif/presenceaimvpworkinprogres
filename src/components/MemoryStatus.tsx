import { Brain, Loader2, CheckCircle, AlertCircle, User, MessageSquare, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmbeddingStatus } from "@/lib/memory";
import type { MemoryCounts } from "@/hooks/useMemorySystem";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MemoryStatusProps {
  status: EmbeddingStatus;
  counts: MemoryCounts;
  isProcessing: boolean;
  onInitialize: () => void;
  onOpenBrowser?: () => void;
}

const MemoryStatus = ({
  status,
  counts,
  isProcessing,
  onInitialize,
  onOpenBrowser,
}: MemoryStatusProps) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
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
                {status === "ready" && `${counts.total} memories`}
                {status === "error" && "Error"}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-3">
            <div className="space-y-2 text-xs">
              <div className="font-medium mb-2">
                {status === "idle" && "Click to initialize ML router + embeddings"}
                {status === "loading" && "Loading embedding model..."}
                {status === "ready" && "Memory System Active (ML Router)"}
                {status === "error" && "Error loading model"}
              </div>
              {status === "ready" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-blue-500" />
                    <span>IMM: {counts.identity} facts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-purple-500" />
                    <span>EMM: {counts.experience} entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3 h-3 text-amber-500" />
                    <span>KMM: {counts.knowledge} items</span>
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        
        {/* Layer indicators when ready */}
        {status === "ready" && (
          <button
            onClick={onOpenBrowser}
            className="hidden md:flex items-center gap-1.5 border-l border-border/50 pl-2 ml-1 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-blue-500">
                  <User className="w-3 h-3" />
                  <span>{counts.identity}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>IMM - Identity Facts</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-purple-500">
                  <MessageSquare className="w-3 h-3" />
                  <span>{counts.experience}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>EMM - Experiences</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-amber-500">
                  <BookOpen className="w-3 h-3" />
                  <span>{counts.knowledge}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>KMM - Knowledge</TooltipContent>
            </Tooltip>
          </button>
        )}
      </div>
    </TooltipProvider>
  );
};

export default MemoryStatus;
