import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onMenuClick: () => void;
  onNewChat: () => void;
}

const ChatHeader = ({ onMenuClick, onNewChat }: ChatHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="text-foreground hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </Button>
      
      <h1 className="text-lg font-semibold text-foreground">Presence AI</h1>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onNewChat}
        className="text-sm border-border bg-muted/50 hover:bg-muted text-foreground"
      >
        New Chat
      </Button>
    </header>
  );
};

export default ChatHeader;
