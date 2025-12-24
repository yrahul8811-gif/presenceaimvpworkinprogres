import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

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
}

const ChatMessage = ({ content, sender, attachments }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed message-slide-in",
        sender === "user"
          ? "self-end gradient-primary text-primary-foreground font-medium"
          : "self-start gradient-ai-bubble border border-primary/20 text-foreground/85"
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
      {content}
    </div>
  );
};

export default ChatMessage;
