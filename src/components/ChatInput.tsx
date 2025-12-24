import { useState, useRef, useEffect } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import MoodSelector, { type MoodType } from "./MoodSelector";
import AttachmentMenu from "./AttachmentMenu";

interface ChatInputProps {
  onSend: (message: string) => void;
  currentMood: MoodType;
  onMoodChange: (mood: MoodType) => void;
}

const ChatInput = ({ onSend, currentMood, onMoodChange }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage("");
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

  const handleAttachmentSelect = (type: string) => {
    // In a real app, implement file upload logic
    console.log(`${type} upload selected`);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
