// InventorySelector.tsx - Furniture & Inventory Selection Component

import React, { useState, useMemo } from 'react';
import { Search, Plus, Minus, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { INVENTORY_CATEGORIES } from './inventory-data';
import { inventoryCategoryName, inventoryItemName } from "./inventory-i18n";
import { useI18n } from "@/i18n/useI18n";
import { InventoryItem } from './types';

interface InventorySelectorProps {
  onAddItem: (item: InventoryItem, categoryId: string) => void;
  onRemoveItem: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  defaultExpanded?: boolean;
}

export function InventorySelector({
  onAddItem,
  onRemoveItem,
  getItemQuantity,
  defaultExpanded = true,
}: InventorySelectorProps) {
  // Inventory names are operator chrome → dashboard locale.
  const { locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(INVENTORY_CATEGORIES[0].id);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Filter categories and items based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return INVENTORY_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return INVENTORY_CATEGORIES.map((category) => ({
      ...category,
      // Search the DISPLAYED name as well as the German base: a French operator types
      // "canapé", not "Sofa". The German base stays searchable because the lead's own
      // free text (and the operator's habits) are still German.
      items: category.items.filter(
        (item) =>
          inventoryItemName(item, locale).toLowerCase().includes(query) ||
          item.name_de.toLowerCase().includes(query)
      ),
    })).filter((category) => category.items.length > 0);
  }, [searchQuery, locale]);

  // Calculate total selected items count
  const totalSelectedItems = useMemo(() => {
    return INVENTORY_CATEGORIES.reduce((total, category) => {
      return (
        total +
        category.items.reduce((catTotal, item) => catTotal + getItemQuantity(item.id), 0)
      );
    }, 0);
  }, [getItemQuantity]);

  // Get selected items count per category for badges
  const getCategoryItemCount = (categoryId: string): number => {
    const category = INVENTORY_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return 0;
    return category.items.reduce((sum, item) => sum + getItemQuantity(item.id), 0);
  };

  return (
    <Card>
      <CardHeader 
        className="pb-3 px-3 sm:px-6 pt-3 sm:pt-6 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <CardTitle className="text-sm sm:text-lg truncate">Möbel & Inventar</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalSelectedItems > 0 && (
              <Badge variant="default" className="text-xs sm:text-sm">
                {totalSelectedItems} Artikel
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <>
          <div className="px-3 sm:px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Möbeln (z.B. Sofa, Bett, Schrank...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-base"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine Möbel gefunden für "{searchQuery}"</p>
          </div>
        ) : (
          <Tabs
            value={searchQuery ? filteredCategories[0]?.id : activeCategory}
            onValueChange={setActiveCategory}
            className="w-full"
          >
            {/* Mobile-friendly scrollable tabs */}
            <div className="overflow-x-auto -mx-1 px-1 pb-2">
              <TabsList className="inline-flex w-max gap-1 bg-muted/50 p-1">
                {filteredCategories.map((category) => {
                  const count = getCategoryItemCount(category.id);
                  return (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="text-xs whitespace-nowrap relative px-2 sm:px-3 h-8"
                    >
                      {inventoryCategoryName(category, locale)}
                      {count > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 h-4 min-w-[16px] px-1 text-[10px]"
                        >
                          {count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {filteredCategories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-3">
                <ScrollArea className="h-[300px] sm:h-[400px] pr-2 sm:pr-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    {category.items.map((item) => {
                      const quantity = getItemQuantity(item.id);
                      const isSelected = quantity > 0;
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 transition-all ${
                            isSelected
                              ? 'bg-primary/5 border-primary/30 shadow-sm'
                              : 'bg-background hover:bg-muted/50 border-border/50'
                          }`}
                        >
                          {/* Item Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm leading-tight ${isSelected ? 'text-primary' : ''}`}>
                              {inventoryItemName(item, locale)}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                              <span className="text-xs flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {item.volume_m3} m³
                              </span>
                              {item.assembly_time_minutes > 0 && (
                                <span className="text-xs">
                                  {item.assembly_time_minutes} Min
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity Controls - Compact */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-10 w-10 rounded-l-lg rounded-r-none border ${
                                isSelected 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary' 
                                  : 'border-border hover:bg-muted'
                              }`}
                              onClick={() => onRemoveItem(item.id)}
                              disabled={quantity === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <div className={`h-10 w-10 flex items-center justify-center border-y font-semibold text-sm tabular-nums ${
                              isSelected ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border'
                            }`}>
                              {quantity}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 rounded-r-lg rounded-l-none border border-border hover:bg-muted"
                              onClick={() => onAddItem(item, category.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
