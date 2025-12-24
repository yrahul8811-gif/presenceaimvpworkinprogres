import { useEffect, useRef } from "react";
import { Image, FileText, Camera } from "lucide-react";

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

const AttachmentMenu = ({ isOpen, onClose, onSelect }: AttachmentMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const options = [
    { type: "photo", icon: Image, label: "Photo" },
    { type: "document", icon: FileText, label: "Document" },
    { type: "camera", icon: Camera, label: "Camera" },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-2xl p-3 shadow-xl z-50 animate-fade-in"
    >
      <div className="flex flex-row gap-4">
        {options.map((option) => (
          <button
            key={option.type}
            onClick={() => {
              onSelect(option.type);
              onClose();
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-muted transition-colors"
          >
            <option.icon className="w-6 h-6 text-foreground/80" />
            <span className="text-xs text-foreground/80 whitespace-nowrap">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AttachmentMenu;
