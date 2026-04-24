import { cn } from "@/lib/utils";
import { ROOM_TYPES, RoomType } from "@/types/virtualBesichtigung";

interface RoomSelectorProps {
  selectedRoom: RoomType;
  onRoomChange: (room: RoomType) => void;
  photoCounts?: Record<RoomType, number>;
  primaryColor?: string;
}

export function RoomSelector({
  selectedRoom,
  onRoomChange,
  photoCounts = {} as Record<RoomType, number>,
  primaryColor,
}: RoomSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {ROOM_TYPES.map((room) => {
        const count = photoCounts[room.id] || 0;
        const isSelected = selectedRoom === room.id;

        return (
          <button
            key={room.id}
            type="button"
            onClick={() => onRoomChange(room.id)}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
            style={
              isSelected && primaryColor
                ? {
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}10`,
                  }
                : undefined
            }
          >
            {/* Room icon */}
            <span className="text-3xl mb-2" role="img" aria-label={room.name}>
              {room.icon}
            </span>

            {/* Room name */}
            <span
              className={cn(
                "text-sm font-medium text-center leading-tight",
                isSelected ? "text-primary" : "text-gray-700"
              )}
              style={isSelected && primaryColor ? { color: primaryColor } : undefined}
            >
              {room.name}
            </span>

            {/* Photo count badge */}
            {count > 0 && (
              <span
                className={cn(
                  "absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center",
                  "rounded-full text-xs font-bold text-white",
                  isSelected ? "bg-primary" : "bg-gray-500"
                )}
                style={isSelected && primaryColor ? { backgroundColor: primaryColor } : undefined}
              >
                {count}
              </span>
            )}

            {/* Description tooltip on hover */}
            {room.description && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {room.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
