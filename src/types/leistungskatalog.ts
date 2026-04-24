/**
 * Shared types for Leistungskatalog (Service Catalog) module
 * Used by: Leistungskatalog.tsx, CatalogServiceSelector.tsx, LeistungsuebersichtSection.tsx
 */

/**
 * A service item from the company's service catalog
 */
export interface ServiceItem {
  id: string;
  company_id: string;
  service_type: string;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  default_price: number;
  is_default_included: boolean;
  is_optional: boolean;
  display_order: number;
}

/**
 * A service item with custom price/quantity overrides (for offers)
 */
export interface SelectedService extends ServiceItem {
  customPrice?: number;
  customQuantity?: number;
}

/**
 * A saved template for quick service selection
 */
export interface LeistungTemplate {
  id: string;
  company_id: string;
  service_type: string;
  name: string;
  description: string | null;
  included_service_ids: string[] | null;
  excluded_services: string[] | null;
  notes: string | null;
  is_active: boolean;
}

/**
 * Predefined service template definition
 */
export interface PredefinedTemplateService {
  category: string;
  name: string;
  description: string;
  unit: string;
  default_price: number;
  is_default_included: boolean;
  is_optional?: boolean;
}

/**
 * Predefined template structure
 */
export interface PredefinedTemplate {
  name: string;
  description?: string;
  serviceType: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  services: PredefinedTemplateService[];
}

/**
 * Service type configuration
 */
export interface ServiceTypeConfig {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

/**
 * Category configuration
 */
export interface CategoryConfig {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Unit configuration
 */
export interface UnitConfig {
  value: string;
  label: string;
}
