import { cn } from "@/lib/utils";

interface ChatMessageProps {
  content: string;
  sender: "user" | "ai";
}

const ChatMessage = ({ content, sender }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed message-slide-in",
        sender === "user"
          ? "self-end gradient-primary text-primary-foreground font-medium"
          : "self-start gradient-ai-bubble border border-primary/20 text-foreground/85"
      )}
    >
      {content}
    </div>
  );
};

export default ChatMessage;
