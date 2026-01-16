import { useState, useCallback, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScribe } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VoiceChatProps {
  onTranscript: (text: string) => void;
  lastAiMessage?: string;
  isAiSpeaking: boolean;
  onSpeakingChange: (speaking: boolean) => void;
}

export function VoiceChat({ 
  onTranscript, 
  lastAiMessage, 
  isAiSpeaking,
  onSpeakingChange 
}: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenRef = useRef<string>("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        onTranscript(data.text.trim());
      }
    },
  });

  const startListening = useCallback(async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-scribe-token"
      );

      if (fnError || !data?.token) {
        throw new Error(fnError?.message || "Failed to get speech token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setIsListening(true);
    } catch (err) {
      console.error("Voice chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to start voice chat");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const stopListening = useCallback(() => {
    scribe.disconnect();
    setIsListening(false);
  }, [scribe]);

  const speakText = useCallback(async (text: string) => {
    if (isMuted || !text || text === lastSpokenRef.current) return;
    
    lastSpokenRef.current = text;
    onSpeakingChange(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        onSpeakingChange(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        onSpeakingChange(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      onSpeakingChange(false);
    }
  }, [isMuted, onSpeakingChange]);

  // Auto-speak AI responses when voice mode is active
  const handleSpeakLastMessage = useCallback(() => {
    if (lastAiMessage && isListening && !isMuted) {
      speakText(lastAiMessage);
    }
  }, [lastAiMessage, isListening, isMuted, speakText]);

  return (
    <div className="flex items-center gap-2">
      {/* Mic Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={isListening ? stopListening : startListening}
        disabled={isConnecting}
        className={cn(
          "relative transition-all",
          isListening && "text-green-500 bg-green-500/10 hover:bg-green-500/20",
          isConnecting && "opacity-50"
        )}
      >
        {isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isListening ? (
          <>
            <Mic className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </>
        ) : (
          <MicOff className="h-5 w-5 text-muted-foreground" />
        )}
      </Button>

      {/* Mute TTS Button */}
      {isListening && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsMuted(!isMuted);
            if (!isMuted && audioRef.current) {
              audioRef.current.pause();
              onSpeakingChange(false);
            }
          }}
          className={cn(
            "transition-all",
            isMuted && "text-red-500"
          )}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className={cn("h-5 w-5", isAiSpeaking && "text-blue-500 animate-pulse")} />
          )}
        </Button>
      )}

      {/* Speak Last Message Button */}
      {isListening && lastAiMessage && !isAiSpeaking && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSpeakLastMessage}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Replay
        </Button>
      )}

      {/* Error Display */}
      {error && (
        <span className="text-xs text-red-500 max-w-[150px] truncate">
          {error}
        </span>
      )}

      {/* Live Transcript Indicator */}
      {scribe.partialTranscript && (
        <span className="text-xs text-muted-foreground italic max-w-[200px] truncate">
          "{scribe.partialTranscript}"
        </span>
      )}
    </div>
  );
}
