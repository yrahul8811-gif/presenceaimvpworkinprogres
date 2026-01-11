import { useState, useEffect } from "react";
import { X, Key, Trash2, Brain, MessageSquare, Lightbulb, RefreshCw, Check, XCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAllIdentityFacts,
  getAllExperiences,
  getAllKnowledge,
  addIdentityFact,
  addExperience,
  addKnowledge,
  updateIdentityFact,
  updateExperience,
  updateKnowledge,
  deleteIdentityFact,
  deleteExperience,
  deleteKnowledge,
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

type EditingState = {
  type: "identity" | "experience" | "knowledge";
  id: string;
  field: string;
  value: string;
} | null;

type AddingState = {
  type: "identity" | "experience" | "knowledge";
} | null;

type NewIdentityForm = {
  key: string;
  value: string;
  category: string;
};

type NewExperienceForm = {
  content: string;
};

type NewKnowledgeForm = {
  content: string;
  category: string;
};

const MemoryPanel = ({ isOpen, onClose, onClearMemory, onRefresh }: MemoryPanelProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [identityFacts, setIdentityFacts] = useState<IdentityFact[]>([]);
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [adding, setAdding] = useState<AddingState>(null);
  const [newIdentity, setNewIdentity] = useState<NewIdentityForm>({ key: "", value: "", category: "preference" });
  const [newExperience, setNewExperience] = useState<NewExperienceForm>({ content: "" });
  const [newKnowledge, setNewKnowledge] = useState<NewKnowledgeForm>({ content: "", category: "fact" });

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const [facts, exps, know] = await Promise.all([
        getAllIdentityFacts(),
        getAllExperiences(),
        getAllKnowledge(),
      ]);
      setIdentityFacts(facts);
      setExperiences(exps.slice(0, 20));
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

  // Edit handlers
  const startEditing = (type: "identity" | "experience" | "knowledge", id: string, field: string, value: string) => {
    setEditing({ type, id, field, value });
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const saveEditing = async () => {
    if (!editing) return;
    
    try {
      if (editing.type === "identity") {
        await updateIdentityFact(editing.id, { [editing.field]: editing.value });
      } else if (editing.type === "experience") {
        await updateExperience(editing.id, { [editing.field]: editing.value });
      } else if (editing.type === "knowledge") {
        await updateKnowledge(editing.id, { [editing.field]: editing.value });
      }
      setEditing(null);
      loadMemories();
      onRefresh();
    } catch (e) {
      console.error("Error saving edit:", e);
    }
  };

  // Delete handlers
  const handleDeleteIdentity = async (id: string) => {
    await deleteIdentityFact(id);
    loadMemories();
    onRefresh();
  };

  const handleDeleteExperience = async (id: string) => {
    await deleteExperience(id);
    loadMemories();
    onRefresh();
  };

  const handleDeleteKnowledge = async (id: string) => {
    await deleteKnowledge(id);
    loadMemories();
    onRefresh();
  };

  // Add handlers
  const handleAddIdentity = async () => {
    if (!newIdentity.key.trim() || !newIdentity.value.trim()) return;
    
    const fact: IdentityFact = {
      id: `identity-${Date.now()}`,
      key: newIdentity.key.trim(),
      value: newIdentity.value.trim(),
      category: newIdentity.category as IdentityFact["category"],
      confidence: 1,
      source: "explicit",
      createdAt: new Date().toISOString(),
      lastConfirmed: new Date().toISOString(),
      confirmationCount: 1,
    };
    
    await addIdentityFact(fact);
    setNewIdentity({ key: "", value: "", category: "preference" });
    setAdding(null);
    loadMemories();
    onRefresh();
  };

  const handleAddExperience = async () => {
    if (!newExperience.content.trim()) return;
    
    const entry: ExperienceEntry = {
      id: `exp-${Date.now()}`,
      content: newExperience.content.trim(),
      role: "user",
      context: "general",
      timestamp: new Date().toISOString(),
      importance: 0.7,
      originalImportance: 0.7,
      embedding: [],
    };
    
    await addExperience(entry);
    setNewExperience({ content: "" });
    setAdding(null);
    loadMemories();
    onRefresh();
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.content.trim()) return;
    
    const entry: KnowledgeEntry = {
      id: `know-${Date.now()}`,
      content: newKnowledge.content.trim(),
      category: newKnowledge.category,
      embedding: [],
      confidence: 1,
      reinforcementCount: 1,
      timestamp: new Date().toISOString(),
    };
    
    await addKnowledge(entry);
    setNewKnowledge({ content: "", category: "fact" });
    setAdding(null);
    loadMemories();
    onRefresh();
  };

  const renderEditableField = (
    type: "identity" | "experience" | "knowledge",
    id: string,
    field: string,
    value: string,
    className: string = ""
  ) => {
    const isEditing = editing?.type === type && editing?.id === id && editing?.field === field;
    
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            className="h-6 text-xs py-0 px-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEditing();
              if (e.key === "Escape") cancelEditing();
            }}
          />
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={saveEditing}>
            <Check className="h-3 w-3 text-mood-calm" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={cancelEditing}>
            <XCircle className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <span
        className={`cursor-pointer hover:bg-muted/50 rounded px-0.5 ${className}`}
        onClick={() => startEditing(type, id, field, value)}
        title="Click to edit"
      >
        {value}
      </span>
    );
  };

  const renderAddForm = (type: "identity" | "experience" | "knowledge") => {
    if (adding?.type !== type) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAdding({ type })}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add {type}
        </Button>
      );
    }

    if (type === "identity") {
      return (
        <div className="mt-2 p-2 bg-muted/50 rounded-lg space-y-2">
          <Input
            placeholder="Key (e.g., name, preference)"
            value={newIdentity.key}
            onChange={(e) => setNewIdentity({ ...newIdentity, key: e.target.value })}
            className="h-7 text-xs"
            autoFocus
          />
          <Input
            placeholder="Value"
            value={newIdentity.value}
            onChange={(e) => setNewIdentity({ ...newIdentity, value: e.target.value })}
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAddIdentity()}
          />
          <select
            value={newIdentity.category}
            onChange={(e) => setNewIdentity({ ...newIdentity, category: e.target.value })}
            className="w-full h-7 text-xs bg-background border border-border rounded px-2"
          >
            <option value="preference">Preference</option>
            <option value="boundary">Boundary</option>
            <option value="value">Value</option>
            <option value="identity">Identity</option>
          </select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddIdentity}>
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    if (type === "experience") {
      return (
        <div className="mt-2 p-2 bg-muted/50 rounded-lg space-y-2">
          <Input
            placeholder="Experience content"
            value={newExperience.content}
            onChange={(e) => setNewExperience({ content: e.target.value })}
            className="h-7 text-xs"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAddExperience()}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddExperience}>
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    if (type === "knowledge") {
      return (
        <div className="mt-2 p-2 bg-muted/50 rounded-lg space-y-2">
          <Input
            placeholder="Knowledge content"
            value={newKnowledge.content}
            onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
            className="h-7 text-xs"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAddKnowledge()}
          />
          <Input
            placeholder="Category"
            value={newKnowledge.category}
            onChange={(e) => setNewKnowledge({ ...newKnowledge, category: e.target.value })}
            className="h-7 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddKnowledge}>
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return null;
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
                    <div key={fact.id} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0 group">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground capitalize">
                          {renderEditableField("identity", fact.id, "key", fact.key)}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {renderEditableField("identity", fact.id, "category", fact.category)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteIdentity(fact.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-foreground/80">
                        {renderEditableField("identity", fact.id, "value", fact.value)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Confirmed {fact.confirmationCount}x • {fact.source}
                      </p>
                    </div>
                  ))
                )}
                {renderAddForm("identity")}
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
                    <div key={exp.id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0 group">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${exp.role === "user" ? "text-primary" : "text-muted-foreground"}`}>
                          {exp.role === "user" ? "You" : "AI"}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{formatTime(exp.timestamp)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteExperience(exp.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-foreground/80 line-clamp-2">
                        {renderEditableField("experience", exp.id, "content", exp.content)}
                      </p>
                      <div className="flex gap-2 mt-1 text-muted-foreground">
                        <span>ctx: {exp.context}</span>
                        <span>imp: {(exp.importance * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))
                )}
                {renderAddForm("experience")}
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
                    <div key={k.id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0 group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground capitalize">
                          {renderEditableField("knowledge", k.id, "category", k.category)}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">×{k.reinforcementCount}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteKnowledge(k.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-foreground/80 line-clamp-2">
                        {renderEditableField("knowledge", k.id, "content", k.content)}
                      </p>
                    </div>
                  ))
                )}
                {renderAddForm("knowledge")}
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
