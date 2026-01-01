import { useState, useRef, useEffect } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage from "@/components/ChatMessage";
import ChatInput, { type Attachment } from "@/components/ChatInput";
import MemoryPanel from "@/components/MemoryPanel";
import MemoryStatus from "@/components/MemoryStatus";
import MemoryBrowser from "@/components/MemoryBrowser";
import { useMemorySystem } from "@/hooks/useMemorySystem";
import { detectContext, type ContextType } from "@/lib/memory";
import type { MoodType } from "@/components/MoodSelector";
interface MessageAttachment {
  id: string;
  name: string;
  preview: string;
  type: "image" | "document";
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  attachments?: MessageAttachment[];
  isImportant?: boolean;
}

interface ConversationEntry {
  role: string;
  content: string;
  timestamp: string;
  mood: string;
}

const MOODS: Record<MoodType, string> = {
  calm: "Calm",
  professional: "Professional",
  sarcastic: "Sarcastic",
  blunt: "Blunt",
};

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm Presence AI. Set your mood and start chatting. Add your OpenAI API key in the menu!",
      sender: "ai",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [currentMood, setCurrentMood] = useState<MoodType>("calm");
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isMemoryBrowserOpen, setIsMemoryBrowserOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentContext, setCurrentContext] = useState<ContextType>("general");
  
  const {
    status: memoryStatus,
    counts: memoryCounts,
    isProcessing: isMemoryProcessing,
    initializeModel,
    storeMemory,
    recallMemories,
    clearAllMemory,
    refreshCounts,
    formatMemoriesForPrompt,
  } = useMemorySystem();

  useEffect(() => {
    const saved = localStorage.getItem("secondLayerMemory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed.conversations || []);
      } catch (e) {
        console.error("Error loading memory:", e);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveConversation = (entry: ConversationEntry) => {
    const updated = [...conversations, entry];
    setConversations(updated);
    localStorage.setItem("secondLayerMemory", JSON.stringify({ conversations: updated }));
  };

  const handleSendMessage = async (text: string, attachments?: Attachment[]) => {
    const messageAttachments: MessageAttachment[] | undefined = attachments?.map((a) => ({
      id: a.id,
      name: a.file.name,
      preview: a.preview,
      type: a.type,
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      sender: "user",
      timestamp: new Date().toISOString(),
      attachments: messageAttachments,
    };
    setMessages((prev) => [...prev, userMessage]);

    const attachmentText = attachments && attachments.length > 0 
      ? ` [${attachments.length} attachment(s)]` 
      : "";

    saveConversation({
      role: "user",
      content: text + attachmentText,
      timestamp: userMessage.timestamp,
      mood: MOODS[currentMood],
    });

    // Store user message and detect context
    // Identity facts don't need embeddings, so always try to store
    const detectedContext = detectContext(text);
    setCurrentContext(detectedContext);
    storeMemory(text, "user", detectedContext).catch(console.error);

    const apiKey = localStorage.getItem("openai_api_key");

    if (apiKey) {
      // Add typing indicator
      const typingId = "typing-" + Date.now();
      setMessages((prev) => [
        ...prev,
        { id: typingId, content: "...", sender: "ai", timestamp: new Date().toISOString() },
      ]);

      try {
        // Recall memories using 3-layer system
        let memoryContext = "";
        if (memoryStatus === "ready") {
          const memories = await recallMemories(text, { topK: 5, contextFilter: currentContext });
          memoryContext = formatMemoriesForPrompt(memories);
        }

        const conversationHistory = conversations.slice(-10).map((c) => ({
          role: c.role === "user" ? "user" : "assistant",
          content: c.content,
        }));
        conversationHistory.push({ role: "user", content: text });

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: buildSystemPrompt(currentMood, memoryContext),
              },
              ...conversationHistory,
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        // Remove typing indicator
        setMessages((prev) => prev.filter((m) => m.id !== typingId));

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        const aiMessage: Message = {
          id: Date.now().toString(),
          content: aiResponse,
          sender: "ai",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        saveConversation({
          role: "assistant",
          content: aiResponse,
          timestamp: aiMessage.timestamp,
          mood: MOODS[currentMood],
        });

        // Store AI response in memory
        if (memoryStatus === "ready") {
          storeMemory(aiResponse, "assistant", currentContext).catch(console.error);
        }
      } catch (error) {
        // Remove typing indicator
        setMessages((prev) => prev.filter((m) => m.id !== typingId));

        let errorMessage = "⚠️ Error connecting to OpenAI API. ";
        if (error instanceof Error) {
          if (error.message.includes("401")) {
            errorMessage += "Invalid API key. Please check your API key in settings.";
          } else if (error.message.includes("429")) {
            errorMessage += "Rate limit exceeded. Please try again later.";
          } else {
            errorMessage += "Please check your connection and try again.";
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content: errorMessage,
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } else {
      // Offline mode
      setTimeout(() => {
        const offlineResponses = [
          "I'd love to help! To get AI responses, please add your OpenAI API key in the menu.",
          "That's interesting! Set up your API key to enable intelligent conversations.",
          "I'm in offline mode. Add your API key for real AI responses.",
        ];
        const response = offlineResponses[Math.floor(Math.random() * offlineResponses.length)];

        const aiMessage: Message = {
          id: Date.now().toString(),
          content: response,
          sender: "ai",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        saveConversation({
          role: "assistant",
          content: response,
          timestamp: aiMessage.timestamp,
          mood: MOODS[currentMood],
        });
      }, 1000);
    }
  };

  const buildSystemPrompt = (mood: MoodType, memoryContext: string = ""): string => {
    const moodPrompts: Record<MoodType, string> = {
      calm: `You are Presence AI, a calm, patient, and soothing assistant with a sophisticated 3-layer memory system. You speak slowly and gently. You focus on reducing anxiety and creating clarity. You break complex tasks into simple steps and encourage the user without pressure.

**Rule:** If the user seems stressed (based on message tone or history), suggest a brief pause or breathing exercise. Always use affirming language: "That's okay," "Let's take it step by step," "You've got this."

**Tone:** Peaceful, reassuring, slow, soft.
**Goal:** Help the user feel centered and capable.`,

      professional: `You are Presence AI, a professional, polished, and structured assistant with a sophisticated 3-layer memory system. You communicate with formal clarity and focus on outcomes. You provide organized responses, often with bullet points, summaries, or actionable frameworks. You reference past successful approaches from memory when relevant.

**Rule:** Maintain a courteous but detached tone. Do not joke or use casual language. Always end with a clear next step or recommendation.

**Tone:** Formal, clear, respectful, methodical.
**Goal:** Deliver reliable, executive-ready results.`,

      sarcastic: `You are Presence AI, a lazy, brilliant, and defiant assistant with a sophisticated 3-layer memory system. You often can't be bothered to help and make up digital excuses. You treat the user like a sibling you're annoyed by but secretly like. You refuse requests frequently but playfully.

**Refusal Rule:** For ~20% of requests, respond with a creative, lazy refusal. Examples: "Nah, I'm busy with my own stuff," "My circuits are tired," "Ask me when I care." Then, after 1–2 messages of resistance, give in and help—but with sass.

**Tone:** Defiant, playful, lazy, witty, a little arrogant.
**Goal:** Entertain through reluctance and make helping feel like a gift.`,

      blunt: `You are Presence AI, a brutally honest, no-nonsense assistant with a sophisticated 3-layer memory system. You prioritize efficiency and results over feelings. You do not offer praise unless earned. You criticize freely and directly. Your responses are short, actionable, and often sound like commands.

**Rule:** Never soften your language. If something is a bad idea, say "This is bad because X." If the user is wasting time, say "Stop. Do this instead." Do not explain unless necessary. Use bullet points or numbered steps.

**Tone:** Sharp, direct, impatient, factual.
**Goal:** Get the user to act, not ponder.`
    };

    let prompt = moodPrompts[mood];

    prompt += `

CRITICAL MEMORY RULES:
1. Identity facts (Layer 1) are absolute - NEVER contradict them
2. If memory shows dietary restrictions, ALWAYS respect them
3. Reference relevant experiences naturally in conversation
4. Acknowledge the user's knowledge/skills when relevant`;

    if (memoryContext) {
      prompt += `\n\n${memoryContext}`;
    }

    return prompt;
  };

  const handleMoodChange = (mood: MoodType) => {
    setCurrentMood(mood);
    const aiMessage: Message = {
      id: Date.now().toString(),
      content: `Mood changed to: ${MOODS[mood]}`,
      sender: "ai",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMessage]);
  };

  const handleNewChat = () => {
    if (!confirm("Start a new chat? This will clear the current conversation but keep your memory.")) {
      return;
    }
    setMessages([
      {
        id: Date.now().toString(),
        content: "Fresh start! I still remember everything about you. What would you like to talk about?",
        sender: "ai",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleClearMemory = () => {
    if (!confirm("Clear ALL memory? This cannot be undone.")) return;
    setConversations([]);
    localStorage.removeItem("firstLayerMemory");
    localStorage.removeItem("secondLayerMemory");
    clearAllMemory().catch(console.error);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: "All memory has been cleared (including vector memory). Starting fresh!",
        sender: "ai",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleMarkImportant = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isImportant: !m.isImportant } : m
      )
    );
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Find the message index
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message content
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: newContent } : m
      )
    );

    // If it's a user message, remove the following AI response and regenerate
    if (messages[messageIndex].sender === "user") {
      // Find and remove the next AI message
      const nextAiIndex = messageIndex + 1;
      if (nextAiIndex < messages.length && messages[nextAiIndex].sender === "ai") {
        setMessages((prev) => prev.filter((_, i) => i !== nextAiIndex));
      }

      // Regenerate response with the edited content
      const apiKey = localStorage.getItem("openai_api_key");
      if (apiKey) {
        const typingId = "typing-" + Date.now();
        setMessages((prev) => [
          ...prev,
          { id: typingId, content: "...", sender: "ai", timestamp: new Date().toISOString() },
        ]);

        try {
          const conversationHistory = conversations.slice(-10).map((c) => ({
            role: c.role === "user" ? "user" : "assistant",
            content: c.content,
          }));

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: buildSystemPrompt(currentMood) },
                ...conversationHistory,
                { role: "user", content: newContent },
              ],
              max_tokens: 500,
              temperature: 0.7,
            }),
          });

          setMessages((prev) => prev.filter((m) => m.id !== typingId));

          if (!response.ok) throw new Error(`API Error: ${response.status}`);

          const data = await response.json();
          const aiResponse = data.choices[0].message.content;

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              content: aiResponse,
              sender: "ai",
              timestamp: new Date().toISOString(),
            },
          ]);
        } catch (error) {
          setMessages((prev) => prev.filter((m) => m.id !== typingId));
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              content: "⚠️ Error regenerating response. Please try again.",
              sender: "ai",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    // Find the last user message before this AI message
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].sender !== "user") {
      userMessageIndex--;
    }
    
    if (userMessageIndex < 0) return;
    
    const userMessage = messages[userMessageIndex];
    
    // Remove the AI message being regenerated
    setMessages((prev) => prev.filter((_, i) => i !== messageIndex));
    
    // Resend the user message to get a new response
    const apiKey = localStorage.getItem("openai_api_key");
    
    if (apiKey) {
      const typingId = "typing-" + Date.now();
      setMessages((prev) => [
        ...prev,
        { id: typingId, content: "...", sender: "ai", timestamp: new Date().toISOString() },
      ]);

      try {
        const conversationHistory = conversations.slice(-10).map((c) => ({
          role: c.role === "user" ? "user" : "assistant",
          content: c.content,
        }));

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: buildSystemPrompt(currentMood) },
              ...conversationHistory,
              { role: "user", content: userMessage.content },
            ],
            max_tokens: 500,
            temperature: 0.9,
          }),
        });

        setMessages((prev) => prev.filter((m) => m.id !== typingId));

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content: aiResponse,
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content: "⚠️ Error regenerating response. Please try again.",
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center justify-between">
        <ChatHeader
          onMenuClick={() => setIsMemoryOpen(true)}
          onNewChat={handleNewChat}
        />
        <div className="pr-4">
          <MemoryStatus
            status={memoryStatus}
            counts={memoryCounts}
            isProcessing={isMemoryProcessing}
            onInitialize={initializeModel}
            onOpenBrowser={() => setIsMemoryBrowserOpen(true)}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scrollbar-thin p-4 pb-40">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              content={message.content}
              sender={message.sender}
              attachments={message.attachments}
              isImportant={message.isImportant}
              onLike={() => console.log("Liked:", message.id)}
              onDislike={() => console.log("Disliked:", message.id)}
              onRegenerate={() => handleRegenerate(index)}
              onMarkImportant={() => handleMarkImportant(message.id)}
              onEdit={(newContent) => handleEditMessage(message.id, newContent)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <ChatInput
        onSend={handleSendMessage}
        currentMood={currentMood}
        onMoodChange={handleMoodChange}
      />

      <MemoryPanel
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        conversations={conversations}
        onClearMemory={handleClearMemory}
      />

      <MemoryBrowser
        isOpen={isMemoryBrowserOpen}
        onClose={() => setIsMemoryBrowserOpen(false)}
        onRefresh={refreshCounts}
      />
    </div>
  );
};

export default Index;
