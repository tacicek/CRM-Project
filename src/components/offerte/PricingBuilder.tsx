// =============================================================================
// PRICING BUILDER - Clean Table Interface for Offer Items
// =============================================================================
// A clean, table-based interface for managing offer line items.
// Supports drag-and-drop reordering and inline editing.
// =============================================================================

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  GripVertical,
  Calculator,
  Package,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export interface PricingItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  priceType: "pauschale" | "per_unit" | "inkl" | "optional";
  highlighted: boolean;
  mwstIncluded: boolean;
}

interface PricingBuilderProps {
  items: PricingItem[];
  onItemsChange: (items: PricingItem[]) => void;
  currency?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const UNITS = [
  { value: "Pauschale", label: "Pauschale" },
  { value: "Stk", label: "Stück" },
  { value: "Std", label: "Stunden" },
  { value: "m²", label: "m²" },
  { value: "m³", label: "m³" },
  { value: "km", label: "km" },
  { value: "kg", label: "kg" },
  { value: "Liter", label: "Liter" },
  { value: "Tag", label: "Tag" },
  { value: "Monat", label: "Monat" },
];

const PRICE_TYPES = [
  { value: "pauschale", label: "Pauschal", description: "Festpreis" },
  { value: "per_unit", label: "Pro Einheit", description: "Menge × Preis" },
  { value: "inkl", label: "Inklusiv", description: "Im Preis enthalten" },
  { value: "optional", label: "Optional", description: "Zusatzoption" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function PricingBuilder({ 
  items, 
  onItemsChange,
  currency = "CHF" 
}: PricingBuilderProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const calculateItemTotal = (item: PricingItem): number => {
    if (item.priceType === "inkl") return 0;
    if (item.priceType === "pauschale") return item.unit_price;
    return item.quantity * item.unit_price;
  };

  const addItem = () => {
    const newItem: PricingItem = {
      id: generateItemId(),
      position: items.length + 1,
      description: "",
      quantity: 1,
      unit: "Pauschale",
      unit_price: 0,
      priceType: "pauschale",
      highlighted: false,
      mwstIncluded: true,
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  const updateItem = useCallback((index: number, field: keyof PricingItem, value: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    onItemsChange(reorderedItems.map((item, i) => ({ ...item, position: i + 1 })));
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-secondary" />
              Positionen & Preise
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Leistungen und Preise für diese Offerte
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={addItem}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Position hinzufügen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="pricing-items">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-8">Pos.</TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead className="w-20">Menge</TableHead>
                        <TableHead className="w-24">Einheit</TableHead>
                        <TableHead className="w-28">Einzelpreis</TableHead>
                        <TableHead className="w-24">Typ</TableHead>
                        <TableHead className="w-24 text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(dragProvided) => (
                            <TableRow
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={item.highlighted ? "bg-yellow-50" : ""}
                            >
                              <TableCell className="py-2">
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground">
                                {item.position}
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateItem(index, "description", e.target.value)}
                                  placeholder="Leistungsbeschreibung..."
                                  className="h-8 text-sm border-0 bg-transparent focus:bg-white focus:border px-0"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm w-full"
                                  min={0}
                                  step={0.5}
                                  disabled={item.priceType === "inkl" || item.priceType === "pauschale"}
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Select
                                  value={item.unit}
                                  onValueChange={(value) => updateItem(index, "unit", value)}
                                  disabled={item.priceType === "inkl"}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNITS.map((unit) => (
                                      <SelectItem key={unit.value} value={unit.value}>
                                        {unit.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm w-full"
                                  min={0}
                                  step={0.05}
                                  disabled={item.priceType === "inkl"}
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Select
                                  value={item.priceType}
                                  onValueChange={(value: PricingItem["priceType"]) => updateItem(index, "priceType", value)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRICE_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 text-right font-medium">
                                {item.priceType === "inkl" ? (
                                  <Badge variant="secondary" className="text-xs">inkl.</Badge>
                                ) : item.priceType === "optional" ? (
                                  <span className="text-muted-foreground text-sm">
                                    ({formatCurrency(calculateItemTotal(item))})
                                  </span>
                                ) : (
                                  <span className="text-sm">{formatCurrency(calculateItemTotal(item))}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  disabled={items.length <= 1}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`border rounded-lg p-3 space-y-3 ${
                            item.highlighted ? "bg-yellow-50 border-yellow-200" : ""
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                {...dragProvided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-muted-foreground"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <Badge variant="outline" className="text-xs">
                                Pos. {item.position}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={items.length <= 1}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* Description */}
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            placeholder="Leistungsbeschreibung..."
                            className="text-sm min-h-[60px]"
                          />

                          {/* Price Row */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-muted-foreground">Menge</label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                                min={0}
                                disabled={item.priceType === "inkl" || item.priceType === "pauschale"}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-muted-foreground">Einheit</label>
                              <Select
                                value={item.unit}
                                onValueChange={(value) => updateItem(index, "unit", value)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map((unit) => (
                                    <SelectItem key={unit.value} value={unit.value}>
                                      {unit.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-muted-foreground">Preis</label>
                              <Input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                                min={0}
                                disabled={item.priceType === "inkl"}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-muted-foreground">Typ</label>
                              <Select
                                value={item.priceType}
                                onValueChange={(value: PricingItem["priceType"]) => updateItem(index, "priceType", value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRICE_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Total */}
                          <div className="flex justify-end pt-2 border-t">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Total</p>
                              {item.priceType === "inkl" ? (
                                <Badge variant="secondary" className="text-xs">inkl.</Badge>
                              ) : item.priceType === "optional" ? (
                                <span className="text-muted-foreground">
                                  ({formatCurrency(calculateItemTotal(item))})
                                </span>
                              ) : (
                                <span className="font-medium">{formatCurrency(calculateItemTotal(item))}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Quick Add Buttons */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addItem}
            className="text-xs h-8"
          >
            <Plus className="w-3 h-3 mr-1" />
            Leere Position
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newItem: PricingItem = {
                id: generateItemId(),
                position: items.length + 1,
                description: "Inklusiv: ",
                quantity: 0,
                unit: "Pauschale",
                unit_price: 0,
                priceType: "inkl",
                highlighted: false,
                mwstIncluded: false,
              };
              onItemsChange([...items, newItem]);
            }}
            className="text-xs h-8"
          >
            <Package className="w-3 h-3 mr-1" />
            Inklusiv-Position
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PricingBuilder;

