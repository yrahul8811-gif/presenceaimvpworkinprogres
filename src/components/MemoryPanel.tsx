import { useState, useEffect } from "react";
import { X, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Array<{ role: string; content: string; timestamp: string }>;
  onClearMemory: () => void;
}

const MemoryPanel = ({ isOpen, onClose, conversations, onClearMemory }: MemoryPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("openai_api_key");
    if (savedKey) {
      setApiKey("••••••••" + savedKey.slice(-4));
      setIsConnected(true);
    }
  }, [isOpen]);

  const handleSaveKey = () => {
    if (!apiKey.trim() || apiKey.startsWith("••••••••")) return;
    localStorage.setItem("openai_api_key", apiKey);
    setApiKey("••••••••" + apiKey.slice(-4));
    setIsConnected(true);
  };

  const handleClearKey = () => {
    localStorage.removeItem("openai_api_key");
    setApiKey("");
    setIsConnected(false);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-background/70 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 w-[85%] max-w-[400px] h-full bg-background border-r border-border z-50 overflow-y-auto scrollbar-thin panel-slide ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold text-foreground">Memory</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* API Key Section */}
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-primary text-sm font-semibold uppercase mb-3">
              <Key className="w-4 h-4" />
              OpenAI API Key
            </div>
            
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key (sk-...)"
              className="bg-background/50 border-border mb-3"
            />
            
            <Button
              onClick={handleSaveKey}
              className="w-full gradient-primary text-primary-foreground font-semibold mb-2"
            >
              Save API Key
            </Button>
            
            <Button
              onClick={handleClearKey}
              variant="outline"
              className="w-full border-border bg-muted/50"
            >
              Clear Key
            </Button>
            
            <div className={`text-xs mt-3 ${isConnected ? "text-mood-calm" : "text-muted-foreground"}`}>
              {isConnected ? "✓ API key connected" : "✗ No API key - offline mode"}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Get your key:{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          {/* First Layer Memory */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-secondary mb-3">
              📋 First Layer Memory
            </h3>
            <div className="bg-muted/30 border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-1">User Identity Profile</div>
              <div className="text-sm text-foreground leading-relaxed">
                Nothing learned yet. Start chatting to build your identity profile.
              </div>
            </div>
          </div>

          {/* Second Layer Memory */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-secondary mb-3">
              💬 Second Layer Memory
            </h3>
            <div className="bg-muted/30 border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground mb-2">💭 Recent Context</div>
              <div className="text-xs text-foreground leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin whitespace-pre-wrap">
                {conversations.length > 0
                  ? conversations.map((c, i) => {
                      const role = c.role === "user" ? "You" : "Bot";
                      const time = new Date(c.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return `[${time}] ${role}: ${c.content}\n\n`;
                    }).join("")
                  : "No conversations yet. Start chatting to build context."}
              </div>
            </div>
          </div>

          {/* Clear Memory Button */}
          <Button
            onClick={onClearMemory}
            variant="outline"
            className="w-full border-destructive/40 bg-destructive/20 hover:bg-destructive/30 text-destructive-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All Memory
          </Button>
        </div>
      </div>
    </>
  );
};

export default MemoryPanel;
