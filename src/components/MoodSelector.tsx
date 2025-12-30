import { cn } from "@/lib/utils";

export type MoodType = "calm" | "professional" | "sarcastic" | "blunt";

interface MoodSelectorProps {
  currentMood: MoodType;
  onMoodChange: (mood: MoodType) => void;
}

const moods: { type: MoodType; label: string }[] = [
  { type: "calm", label: "Calm" },
  { type: "professional", label: "Professional" },
  { type: "sarcastic", label: "Sarcastic" },
  { type: "blunt", label: "Blunt" },
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
          aria-label={mood.label}
        />
      ))}
    </div>
  );
};

export default MoodSelector;
