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

const MoodSelector = ({ currentMood, onMoodChange }: MoodSelectorProps) => {
  return (
    <div className="flex gap-2">
      {moods.map((mood) => (
        <button
          key={mood.type}
          onClick={() => onMoodChange(mood.type)}
          title={mood.label}
          className={cn(
            `mood-btn mood-${mood.type}`,
            currentMood === mood.type ? "active" : "inactive"
          )}
        />
      ))}
    </div>
  );
};

export default MoodSelector;
