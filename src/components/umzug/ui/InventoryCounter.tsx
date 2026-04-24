// InventoryCounter.tsx - Counter for inventory items with category grouping

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Minus, Plus, ChevronDown, ChevronUp, 
  Sofa, BedDouble, UtensilsCrossed, Briefcase, Package, AlertTriangle
} from "lucide-react";
import { InventoryItem, InventoryCategory } from "@/types/umzug";

interface InventoryCounterProps {
  categories: InventoryCategory[];
  onChange: (items: InventoryItem[]) => void;
  className?: string;
}

export const InventoryCounter = ({
  categories,
  onChange,
  className,
}: InventoryCounterProps) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    categories.map(c => c.name)
  );

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const updateItemCount = (categoryName: string, itemName: string, delta: number) => {
    const allItems = categories.flatMap(c => c.items);
    const updatedItems = allItems.map(item => {
      if (item.kategorie === categoryName && item.name === itemName) {
        return { ...item, anzahl: Math.max(0, item.anzahl + delta) };
      }
      return item;
    });
    onChange(updatedItems);
  };

  const getTotalCount = (category: InventoryCategory) => {
    return category.items.reduce((sum, item) => sum + item.anzahl, 0);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {categories.map((category) => {
        const isExpanded = expandedCategories.includes(category.name);
        const totalCount = getTotalCount(category);
        
        return (
          <div
            key={category.name}
            className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(category.name)}
              className={cn(
                "w-full flex items-center justify-between p-4 text-left",
                "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800",
                "transition-colors duration-200"
              )}
            >
              <div className="flex items-center gap-3">
                <CategoryIcon category={category.name} />
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {category.name}
                </span>
                {totalCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded-full">
                    {totalCount}
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            
            {/* Category Items */}
            {isExpanded && (
              <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
                {category.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.name}
                      </span>
                      {item.aufpreis_chf && (
                        <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                          +CHF {item.aufpreis_chf}
                        </span>
                      )}
                    </div>
                    
                    {/* Counter */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateItemCount(category.name, item.name, -1)}
                        disabled={item.anzahl === 0}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                          item.anzahl === 0
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        )}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      <span className={cn(
                        "w-10 text-center font-semibold",
                        item.anzahl > 0 
                          ? "text-blue-600 dark:text-blue-400" 
                          : "text-gray-400"
                      )}>
                        {item.anzahl}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => updateItemCount(category.name, item.name, 1)}
                        className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Category icon component
const CategoryIcon = ({ category }: { category: string }) => {
  const iconMap: Record<string, React.ReactNode> = {
    'Wohnzimmer': <Sofa className="w-5 h-5 text-gray-500" />,
    'Schlafzimmer': <BedDouble className="w-5 h-5 text-gray-500" />,
    'Küche': <UtensilsCrossed className="w-5 h-5 text-gray-500" />,
    'Büro': <Briefcase className="w-5 h-5 text-gray-500" />,
    'Sonstiges': <Package className="w-5 h-5 text-gray-500" />,
    'Spezial': <AlertTriangle className="w-5 h-5 text-gray-500" />,
  };
  
  return (
    <div className="w-8 h-8 flex items-center justify-center">
      {iconMap[category] || <Package className="w-5 h-5 text-gray-500" />}
    </div>
  );
};


