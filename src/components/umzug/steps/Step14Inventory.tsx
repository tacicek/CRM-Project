// Step14Inventory.tsx - Inventory overview

import { useState } from "react";
import { InventoryCounter } from "../ui/InventoryCounter";
import { CounterInput } from "@/components/reinigung/ui/CounterInput";
import { 
  InventoryItem, 
  DEFAULT_INVENTORY, 
  SPECIAL_ITEMS,
  InventoryCategory 
} from "@/types/umzug";
import { Package, AlertTriangle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";

interface Step14Props {
  data: {
    items: InventoryItem[];
    geschaetzte_kartons: number;
    schwere_gegenstaende: InventoryItem[];
  };
  onChange: (data: {
    items: InventoryItem[];
    geschaetzte_kartons: number;
    schwere_gegenstaende: InventoryItem[];
  }) => void;
}

export const Step14Inventory = ({ data, onChange }: Step14Props) => {
  const [showSpecialItems, setShowSpecialItems] = useState(false);
  
  // Initialize categories with current data or defaults
  const [categories, setCategories] = useState<InventoryCategory[]>(() => {
    if (data.items.length > 0) {
      // Group existing items by category
      const grouped = data.items.reduce((acc, item) => {
        if (!acc[item.kategorie]) {
          acc[item.kategorie] = [];
        }
        acc[item.kategorie].push(item);
        return acc;
      }, {} as Record<string, InventoryItem[]>);
      
      return DEFAULT_INVENTORY.map(cat => ({
        ...cat,
        items: cat.items.map(item => {
          const existingItem = grouped[cat.name]?.find(i => i.name === item.name);
          return existingItem || item;
        })
      }));
    }
    return DEFAULT_INVENTORY;
  });

  const [specialItems, setSpecialItems] = useState<InventoryItem[]>(() => {
    if (data.schwere_gegenstaende.length > 0) {
      return SPECIAL_ITEMS.map(item => {
        const existingItem = data.schwere_gegenstaende.find(i => i.name === item.name);
        return existingItem || item;
      });
    }
    return SPECIAL_ITEMS;
  });

  const handleItemsChange = (items: InventoryItem[]) => {
    // Update categories
    const updatedCategories = categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => {
        const updatedItem = items.find(i => i.name === item.name && i.kategorie === cat.name);
        return updatedItem || item;
      })
    }));
    setCategories(updatedCategories);
    
    // Calculate karton count from items
    const kartonCount = items
      .filter(item => item.name.toLowerCase().includes("karton"))
      .reduce((sum, item) => sum + item.anzahl, 0);
    
    // Update parent with calculated karton count
    onChange({
      ...data,
      items: items.filter(i => i.anzahl > 0),
      geschaetzte_kartons: kartonCount
    });
  };

  const handleSpecialItemChange = (itemName: string, anzahl: number) => {
    const updatedSpecialItems = specialItems.map(item => 
      item.name === itemName ? { ...item, anzahl } : item
    );
    setSpecialItems(updatedSpecialItems);
    
    onChange({
      ...data,
      schwere_gegenstaende: updatedSpecialItems.filter(i => i.anzahl > 0)
    });
  };

  const getTotalItemCount = () => {
    return categories.reduce((sum, cat) => 
      sum + cat.items.reduce((catSum, item) => catSum + item.anzahl, 0), 0
    );
  };

  const getTotalSpecialCount = () => {
    return specialItems.reduce((sum, item) => sum + item.anzahl, 0);
  };

  // Get karton count from "Sonstiges" category
  const getKartonCount = () => {
    const sonstigesCategory = categories.find(cat => cat.name === "Sonstiges");
    if (!sonstigesCategory) return 0;
    return sonstigesCategory.items
      .filter(item => item.name.toLowerCase().includes("karton"))
      .reduce((sum, item) => sum + item.anzahl, 0);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <Package className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Inventar - Was wird transportiert?
        </h2>
        <p className="text-gray-600">
          Optional, aber hilfreich für eine genaue Kalkulation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-center">
          <p className="text-2xl font-bold text-purple-600">
            {getTotalItemCount()}
          </p>
          <p className="text-xs text-purple-600">Möbelstücke</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {getKartonCount()}
          </p>
          <p className="text-xs text-blue-600">Kartons</p>
        </div>
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-center">
          <p className="text-2xl font-bold text-orange-600">
            {getTotalSpecialCount()}
          </p>
          <p className="text-xs text-orange-600">Spezial</p>
        </div>
      </div>

      {/* Inventory Counter */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">
          Möbel & Gegenstände
        </h3>
        <InventoryCounter
          categories={categories}
          onChange={handleItemsChange}
        />
      </div>

      {/* Special/Heavy Items */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowSpecialItems(!showSpecialItems)}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div className="text-left">
              <span className="font-medium text-gray-800 block">
                Schwere / Spezielle Gegenstände
              </span>
              <span className="text-sm text-orange-600">
                Klavier, Tresor, Aquarium, etc.
              </span>
            </div>
          </div>
          {showSpecialItems ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {showSpecialItems && (
          <div className="p-4 rounded-xl bg-white border border-orange-200 space-y-4 animate-in slide-in-from-top-4 duration-300">
            {specialItems.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <div className="flex-1">
                  <span className="text-gray-700">
                    {item.name}
                  </span>
                  {item.aufpreis_chf && (
                    <span className="ml-2 text-xs text-orange-600">
                      +CHF {item.aufpreis_chf}
                    </span>
                  )}
                </div>
                <CounterInput
                  value={item.anzahl}
                  onChange={(value) => handleSpecialItemChange(item.name, value)}
                  min={0}
                  max={10}
                />
              </div>
            ))}
            
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Spezielle Gegenstände erfordern zusätzliche Vorbereitung und können 
              Aufpreise verursachen.</span>
            </p>
          </div>
        )}
      </div>

      {/* Skip Option */}
      <div className="text-center">
        <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
          <Lightbulb className="w-4 h-4 shrink-0" />
          <span>Sie können diese Angaben auch später ergänzen oder dem Umzugsunternehmen 
          bei der Besichtigung mitteilen.</span>
        </p>
      </div>
    </div>
  );
};


