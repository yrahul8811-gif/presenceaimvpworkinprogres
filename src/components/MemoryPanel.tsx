import { useState, useEffect } from "react";
import { X, Key, Trash2, Brain, MessageSquare, Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAllIdentityFacts,
  getAllExperiences,
  getAllKnowledge,
  type IdentityFact,
  type ExperienceEntry,
  type KnowledgeEntry,
} from "@/lib/memory";

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onClearMemory: () => void;
  onRefresh: () => void;
}

const MemoryPanel = ({ isOpen, onClose, onClearMemory, onRefresh }: MemoryPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [identityFacts, setIdentityFacts] = useState<IdentityFact[]>([]);
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const [facts, exps, know] = await Promise.all([
        getAllIdentityFacts(),
        getAllExperiences(),
        getAllKnowledge(),
      ]);
      setIdentityFacts(facts);
      setExperiences(exps.slice(0, 20)); // Limit for performance
      setKnowledge(know.slice(0, 20));
    } catch (e) {
      console.error("Error loading memories:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem("openai_api_key");
      if (savedKey) {
        setApiKey("••••••••" + savedKey.slice(-4));
        setIsConnected(true);
      }
      loadMemories();
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

  const handleClearAll = () => {
    onClearMemory();
    setIdentityFacts([]);
    setExperiences([]);
    setKnowledge([]);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        className={`fixed top-0 left-0 w-[85%] max-w-[400px] h-full bg-background border-r border-border z-50 overflow-hidden panel-slide ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Memory System</h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { loadMemories(); onRefresh(); }}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-5">
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
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveKey}
                  size="sm"
                  className="flex-1 gradient-primary text-primary-foreground font-semibold"
                >
                  Save
                </Button>
                <Button
                  onClick={handleClearKey}
                  variant="outline"
                  size="sm"
                  className="border-border bg-muted/50"
                >
                  Clear
                </Button>
              </div>
              
              <div className={`text-xs mt-3 ${isConnected ? "text-mood-calm" : "text-muted-foreground"}`}>
                {isConnected ? "✓ API key connected" : "✗ No API key - offline mode"}
              </div>
            </div>

            {/* Layer 1: Identity Memory */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-mood-professional" />
                <h3 className="text-sm font-semibold uppercase text-mood-professional">
                  Identity Memory (IMM)
                </h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {identityFacts.length} facts
                </span>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                {identityFacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No identity facts yet. Tell me about yourself!
                  </p>
                ) : (
                  identityFacts.map((fact) => (
                    <div key={fact.id} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground capitalize">{fact.key}</span>
                        <span className="text-xs text-muted-foreground">{fact.category}</span>
                      </div>
                      <p className="text-foreground/80">{fact.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Confirmed {fact.confirmationCount}x • {fact.source}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Layer 2: Experience Memory */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-mood-calm" />
                <h3 className="text-sm font-semibold uppercase text-mood-calm">
                  Experience Memory (EMM)
                </h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {experiences.length} entries
                </span>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {experiences.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No experiences stored yet.
                  </p>
                ) : (
                  experiences.map((exp) => (
                    <div key={exp.id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${exp.role === "user" ? "text-primary" : "text-muted-foreground"}`}>
                          {exp.role === "user" ? "You" : "AI"}
                        </span>
                        <span className="text-muted-foreground">{formatTime(exp.timestamp)}</span>
                      </div>
                      <p className="text-foreground/80 line-clamp-2">{exp.content}</p>
                      <div className="flex gap-2 mt-1 text-muted-foreground">
                        <span>ctx: {exp.context}</span>
                        <span>imp: {(exp.importance * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Layer 3: Knowledge Memory */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-mood-sarcastic" />
                <h3 className="text-sm font-semibold uppercase text-mood-sarcastic">
                  Knowledge Memory (KMM)
                </h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {knowledge.length} entries
                </span>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {knowledge.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No knowledge stored yet.
                  </p>
                ) : (
                  knowledge.map((k) => (
                    <div key={k.id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground capitalize">{k.category}</span>
                        <span className="text-muted-foreground">×{k.reinforcementCount}</span>
                      </div>
                      <p className="text-foreground/80 line-clamp-2">{k.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Clear Memory Button */}
            <Button
              onClick={handleClearAll}
              variant="outline"
              className="w-full border-destructive/40 bg-destructive/20 hover:bg-destructive/30 text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Memory
            </Button>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default MemoryPanel;