import { useState, useEffect } from "react";
import { X, Brain, Clock, Lightbulb, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  getAllIdentityFacts, 
  deleteIdentityFact,
  getAllExperiences,
  deleteExperience,
  getAllKnowledge,
  deleteKnowledge,
  type IdentityFact,
  type ExperienceEntry,
  type KnowledgeEntry,
} from "@/lib/memory";

interface MemoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const MemoryBrowser = ({ isOpen, onClose, onRefresh }: MemoryBrowserProps) => {
  const [identityFacts, setIdentityFacts] = useState<IdentityFact[]>([]);
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAllMemories = async () => {
    setIsLoading(true);
    try {
      const [facts, exps, knows] = await Promise.all([
        getAllIdentityFacts(),
        getAllExperiences(),
        getAllKnowledge(),
      ]);
      setIdentityFacts(facts);
      setExperiences(exps);
      setKnowledge(knows);
    } catch (error) {
      console.error("Failed to load memories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllMemories();
    }
  }, [isOpen]);

  const handleDeleteIdentity = async (id: string) => {
    await deleteIdentityFact(id);
    await loadAllMemories();
    onRefresh();
  };

  const handleDeleteExperience = async (id: string) => {
    await deleteExperience(id);
    await loadAllMemories();
    onRefresh();
  };

  const handleDeleteKnowledge = async (id: string) => {
    await deleteKnowledge(id);
    await loadAllMemories();
    onRefresh();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Memory Browser</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadAllMemories}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="identity" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 grid grid-cols-3">
            <TabsTrigger value="identity" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              IMM ({identityFacts.length})
            </TabsTrigger>
            <TabsTrigger value="experience" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              EMM ({experiences.length})
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              KMM ({knowledge.length})
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="flex-1 overflow-hidden m-0 p-6">
            <ScrollArea className="h-full">
              {identityFacts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No identity facts stored yet.</p>
                  <p className="text-sm mt-1">Try saying "My name is..." or "I prefer..."</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {identityFacts.map((fact) => (
                    <div
                      key={fact.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {fact.key}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {fact.category}
                            </Badge>
                          </div>
                          <p className="font-medium">{fact.value}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Confidence: {(fact.confidence * 100).toFixed(0)}% • 
                            Confirmed {fact.confirmationCount}x • 
                            {formatDate(fact.lastConfirmed)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleDeleteIdentity(fact.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Experience Tab */}
          <TabsContent value="experience" className="flex-1 overflow-hidden m-0 p-6">
            <ScrollArea className="h-full">
              {experiences.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No experiences stored yet.</p>
                  <p className="text-sm mt-1">Conversations will be stored here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {experiences.slice().reverse().map((exp) => (
                    <div
                      key={exp.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {exp.role}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {exp.context}
                            </Badge>
                          </div>
                          <p className="text-sm line-clamp-3">{exp.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Importance: {(exp.importance * 100).toFixed(0)}% • 
                            {formatDate(exp.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleDeleteExperience(exp.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="flex-1 overflow-hidden m-0 p-6">
            <ScrollArea className="h-full">
              {knowledge.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No knowledge stored yet.</p>
                  <p className="text-sm mt-1">Try saying "I know..." or "I'm good at..."</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledge.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                          </div>
                          <p className="text-sm">{item.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Confidence: {(item.confidence * 100).toFixed(0)}% • 
                            Reinforced {item.reinforcementCount}x • 
                            {formatDate(item.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => handleDeleteKnowledge(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MemoryBrowser;
