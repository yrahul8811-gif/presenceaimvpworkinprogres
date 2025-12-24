import { useState, useRef, useEffect } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import MemoryPanel from "@/components/MemoryPanel";
import type { MoodType } from "@/components/MoodSelector";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
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
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    saveConversation({
      role: "user",
      content: text,
      timestamp: userMessage.timestamp,
      mood: MOODS[currentMood],
    });

    const apiKey = localStorage.getItem("openai_api_key");

    if (apiKey) {
      // Add typing indicator
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
                content: buildSystemPrompt(currentMood),
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

  const buildSystemPrompt = (mood: MoodType): string => {
    const moodName = MOODS[mood].toLowerCase();
    return `You are Presence AI, a personal AI companion. Respond in a ${moodName} tone.

Current mood style:
- Calm: Warm, reflective, encouraging, asks follow-up questions
- Professional: Formal, structured, action-oriented
- Sarcastic: Witty, playful, tongue-in-cheek but still helpful
- Blunt: Direct, minimal words, straight to the point

Keep responses conversational and appropriate for the ${moodName} mood.`;
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
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: "All memory has been cleared. Starting fresh!",
        sender: "ai",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ChatHeader
        onMenuClick={() => setIsMemoryOpen(true)}
        onNewChat={handleNewChat}
      />

      <main className="flex-1 overflow-y-auto scrollbar-thin p-4 pb-40">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              content={message.content}
              sender={message.sender}
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
    </div>
  );
};

export default Index;
