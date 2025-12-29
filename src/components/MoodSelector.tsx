import { cn } from "@/lib/utils";

export type MoodType = "calm" | "professional" | "sarcastic" | "blunt";

interface MoodSelectorProps {
  currentMood: MoodType;
  onMoodChange: (mood: MoodType) => void;
}

const moods: { type: MoodType; emoji: string; label: string }[] = [
  { type: "calm", emoji: "😌", label: "Calm" },
  { type: "professional", emoji: "💼", label: "Professional" },
  { type: "sarcastic", emoji: "😏", label: "Sarcastic" },
  { type: "blunt", emoji: "🎯", label: "Blunt" },
];

const moodColors: Record<MoodType, string> = {
  calm: "hsl(142, 71%, 45%)",
  professional: "hsl(48, 96%, 53%)",
  sarcastic: "hsl(0, 72%, 51%)",
  blunt: "hsl(217, 91%, 60%)",
};

const MoodSelector = ({ currentMood, onMoodChange }: MoodSelectorProps) => {
  return (
    <div className="flex gap-2">
      {moods.map((mood) => (
        <button
          key={mood.type}
          onClick={() => onMoodChange(mood.type)}
          title={mood.label}
          style={{ backgroundColor: moodColors[mood.type] }}
          className={cn(
            "mood-btn",
            currentMood === mood.type && "active"
          )}
        >
          {mood.emoji}
        </button>
      ))}
    </div>
  );
};

export default MoodSelector;
