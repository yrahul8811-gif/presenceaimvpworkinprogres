import { useState, useRef, useEffect } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MoodSelector, { type MoodType } from "./MoodSelector";
import AttachmentMenu from "./AttachmentMenu";
import { toast } from "@/hooks/use-toast";

export interface Attachment {
  id: string;
  file: File;
  preview: string;
  type: "image" | "document";
}

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  currentMood: MoodType;
  onMoodChange: (mood: MoodType) => void;
}

const ChatInput = ({ onSend, currentMood, onMoodChange }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;
    onSend(message.trim(), attachments.length > 0 ? attachments : undefined);
    setMessage("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const newAttachments: Attachment[] = [];
    
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isDocument = file.type === "application/pdf" || 
                        file.type.includes("document") ||
                        file.type.includes("text");
      
      if (!isImage && !isDocument) {
        toast({
          title: "Unsupported file type",
          description: "Please upload images or documents only.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        });
        return;
      }

      const preview = isImage ? URL.createObjectURL(file) : "";
      
      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
        type: isImage ? "image" : "document",
      });
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleAttachmentSelect = (type: string) => {
    if (type === "photo" || type === "document") {
      if (fileInputRef.current) {
        fileInputRef.current.accept = type === "photo" ? "image/*" : ".pdf,.doc,.docx,.txt";
        fileInputRef.current.click();
      }
    } else if (type === "camera") {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border"
            >
              {attachment.type === "image" ? (
                <img
                  src={attachment.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <span className="text-xs text-center px-1 truncate">
                    {attachment.file.name.slice(0, 8)}...
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1 bg-muted/50 border border-border rounded-3xl px-4 py-2 min-h-[44px] flex items-center">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Presence AI..."
            rows={1}
            className="flex-1 bg-transparent border-none text-foreground text-[15px] outline-none resize-none max-h-[120px] leading-relaxed placeholder:text-muted-foreground"
          />
        </div>
        
        <Button
          onClick={handleSend}
          size="icon"
          className="w-11 h-11 rounded-full gradient-send border-none hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Send className="w-5 h-5 text-primary-foreground" />
        </Button>
      </div>

      {/* Moods Row */}
      <div className="flex items-center gap-3 px-1">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAttachment(!showAttachment)}
            className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted"
          >
            <Paperclip className="w-4 h-4 text-muted-foreground" />
          </Button>
          
          <AttachmentMenu
            isOpen={showAttachment}
            onClose={() => setShowAttachment(false)}
            onSelect={handleAttachmentSelect}
          />
        </div>

        <MoodSelector currentMood={currentMood} onMoodChange={onMoodChange} />
      </div>
    </div>
  );
};

export default ChatInput;
