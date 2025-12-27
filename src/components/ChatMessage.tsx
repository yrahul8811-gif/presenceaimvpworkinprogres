import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ThumbsUp, ThumbsDown, Copy, RefreshCw, Star, Pencil, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MessageAttachment {
  id: string;
  name: string;
  preview: string;
  type: "image" | "document";
}

interface ChatMessageProps {
  content: string;
  sender: "user" | "ai";
  attachments?: MessageAttachment[];
  onLike?: () => void;
  onDislike?: () => void;
  onRegenerate?: () => void;
  onMarkImportant?: () => void;
  onEdit?: (newContent: string) => void;
  isImportant?: boolean;
}

const ChatMessage = ({ 
  content, 
  sender, 
  attachments,
  onLike,
  onDislike,
  onRegenerate,
  onMarkImportant,
  onEdit,
  isImportant = false
}: ChatMessageProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const handleLike = () => {
    setLiked(!liked);
    setDisliked(false);
    onLike?.();
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    setLiked(false);
    onDislike?.();
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== content) {
      onEdit?.(editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group relative max-w-[85%] message-slide-in",
        sender === "user" ? "self-end" : "self-start"
      )}
    >
      <div
        className={cn(
          "text-sm leading-relaxed",
          sender === "user"
            ? "px-4 py-3 rounded-2xl gradient-primary text-primary-foreground font-medium"
            : "text-foreground/90",
          isImportant && "ring-2 ring-yellow-500/50 rounded-lg px-2"
        )}
      >
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-lg overflow-hidden">
                {attachment.type === "image" ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.name}
                    className="max-w-[200px] max-h-[150px] object-cover rounded-lg"
                  />
                ) : (
                  <div className="flex items-center gap-2 bg-background/20 px-3 py-2 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs truncate max-w-[120px]">{attachment.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[60px] bg-background/20 rounded-lg p-2 text-sm resize-none focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 text-xs rounded bg-primary/20 hover:bg-primary/30 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          content
        )}
      </div>

      {/* Action buttons */}
      <div
        className={cn(
          "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
          sender === "user" ? "justify-end" : "justify-start"
        )}
      >
        {sender === "ai" ? (
          <>
            <ActionButton
              icon={<ThumbsUp className={cn("w-3.5 h-3.5", liked && "fill-current")} />}
              onClick={handleLike}
              active={liked}
              tooltip="Like"
            />
            <ActionButton
              icon={<ThumbsDown className={cn("w-3.5 h-3.5", disliked && "fill-current")} />}
              onClick={handleDislike}
              active={disliked}
              tooltip="Dislike"
            />
            <ActionButton
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={handleCopy}
              tooltip="Copy"
            />
            <ActionButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onRegenerate}
              tooltip="Regenerate"
            />
            <ActionButton
              icon={<Star className={cn("w-3.5 h-3.5", isImportant && "fill-yellow-500 text-yellow-500")} />}
              onClick={onMarkImportant}
              active={isImportant}
              tooltip="Mark Important"
            />
          </>
        ) : (
          <>
            <ActionButton
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => setIsEditing(true)}
              tooltip="Edit"
            />
            <ActionButton
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={handleCopy}
              tooltip="Copy"
            />
          </>
        )}
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  tooltip: string;
}

const ActionButton = ({ icon, onClick, active = false, tooltip }: ActionButtonProps) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={cn(
      "p-1.5 rounded-md transition-colors hover:bg-muted/50",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
  </button>
);

export default ChatMessage;
