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

const MoodSelector = ({ currentMood, onMoodChange }: MoodSelectorProps) => {
  return (
    <div className="flex gap-2">
      {moods.map((mood) => (
        <button
          key={mood.type}
          onClick={() => onMoodChange(mood.type)}
          title={mood.label}
          className={cn(
            "mood-btn",
            `mood-${mood.type}`,
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
