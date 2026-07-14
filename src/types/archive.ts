// =============================================================================
// DATA ARCHIVING SYSTEM TYPES
// TypeScript interfaces for the archiving system
// =============================================================================

import type { Locale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";

export type ArchiveType =
  | 'leads'
  | 'offers'
  | 'email_logs'
  | 'notifications'
  | 'analytics'
  | 'appointments'
  | 'full_backup'
  | 'custom';

export type StorageType = 
  | 'local'
  | 'google_drive'
  | 'dropbox'
  | 's3'
  | 'supabase_storage';

export type ExportFormat = 'json' | 'csv' | 'parquet';

export type ArchiveStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'restored';

export type ArchiveTrigger = 'manual' | 'auto' | 'scheduled';

// =============================================================================
// ARCHIVE SETTINGS
// =============================================================================

export interface ArchiveSettings {
  id: string;
  
  // General settings
  is_enabled: boolean;
  auto_archive_day: number; // 1-28
  
  // Retention periods (in days)
  leads_retention_days: number;
  offers_retention_days: number;
  email_logs_retention_days: number;
  notifications_retention_days: number;
  analytics_retention_days: number;
  appointments_retention_days: number;
  
  // Export settings
  default_export_format: ExportFormat;
  compress_archives: boolean;
  
  // Cloud storage settings
  google_drive_enabled: boolean;
  google_drive_folder_id?: string;
  dropbox_enabled: boolean;
  dropbox_folder_path?: string;
  s3_enabled: boolean;
  s3_bucket_name?: string;
  s3_region?: string;
  
  // Notification settings
  notify_on_archive: boolean;
  notify_email?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

// =============================================================================
// ARCHIVE LOG
// =============================================================================

export interface ArchiveLog {
  id: string;
  
  // Archive info
  archive_name: string;
  archive_type: ArchiveType;
  
  // Statistics
  records_archived: number;
  file_size_bytes: number;
  compression_ratio?: number;
  
  // Date range
  data_from_date?: string;
  data_to_date?: string;
  
  // Storage location
  storage_type: StorageType;
  storage_path?: string;
  storage_url?: string;
  
  // Export format
  export_format: ExportFormat;
  
  // Status
  status: ArchiveStatus;
  error_message?: string;
  
  // Trigger info
  triggered_by: ArchiveTrigger;
  triggered_by_user_id?: string;
  
  // Data deleted from DB?
  source_data_deleted: boolean;
  deleted_at?: string;
  
  // Restore info
  is_restorable: boolean;
  restored_at?: string;
  restored_by_user_id?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

// =============================================================================
// ARCHIVE SNAPSHOT
// =============================================================================

export interface ArchiveSnapshot {
  id: string;
  archive_log_id: string;
  
  // Data chunk info
  chunk_number: number;
  total_chunks: number;
  
  // Archived data
  data: Record<string, unknown>[];
  record_count: number;
  
  // Checksum
  checksum?: string;
  
  created_at: string;
}

// =============================================================================
// ARCHIVE STATISTICS
// =============================================================================

export interface ArchiveStatistics {
  table_name: string;
  total_records: number;
  archivable_records: number;
  oldest_record_date?: string;
  estimated_size_mb: number;
}

// =============================================================================
// ARCHIVE REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateArchiveRequest {
  archive_type: ArchiveType;
  storage_type: StorageType;
  export_format?: ExportFormat;
  custom_name?: string;
  retention_days?: number;
  delete_after_archive?: boolean;
  include_related_data?: boolean;
}

export interface CreateArchiveResponse {
  success: boolean;
  archive_id?: string;
  records_archived?: number;
  file_size_bytes?: number;
  download_url?: string;
  error?: string;
}

export interface RestoreArchiveRequest {
  archive_id: string;
  restore_to_original_table?: boolean;
  create_new_table?: boolean;
  new_table_suffix?: string;
}

export interface RestoreArchiveResponse {
  success: boolean;
  records_restored?: number;
  target_table?: string;
  error?: string;
}

// =============================================================================
// EXPORT DATA STRUCTURES
// =============================================================================

export interface ExportedLeadData {
  lead: Record<string, unknown>;
  distributions?: Record<string, unknown>[];
  offers?: Record<string, unknown>[];
  appointments?: Record<string, unknown>[];
}

export interface ExportedOfferData {
  offer: Record<string, unknown>;
  offer_items?: Record<string, unknown>[];
}

export interface ArchiveExportFile {
  version: string;
  export_date: string;
  archive_type: ArchiveType;
  total_records: number;
  data_from: string;
  data_to: string;
  checksum: string;
  data: Record<string, unknown>[];
}

// =============================================================================
// UI COMPONENT PROPS
// =============================================================================

export interface ArchiveTableRowProps {
  archive: ArchiveLog;
  onDownload: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface ArchiveSettingsFormProps {
  settings: ArchiveSettings;
  onSave: (settings: Partial<ArchiveSettings>) => Promise<void>;
  isLoading?: boolean;
}

export interface ArchiveStatisticsCardProps {
  statistics: ArchiveStatistics[];
  isLoading?: boolean;
  onRefresh: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// The archive UI is operator-facing, so every label follows the DASHBOARD locale and is
// therefore resolved through an explicit `locale` argument — never through React context,
// which would make these helpers unusable outside components.

export const getArchiveTypeLabel = (type: ArchiveType, locale: Locale): string =>
  createTranslator(locale)(`archive.type.${type}` as const);

export const getStorageTypeLabel = (type: StorageType, locale: Locale): string =>
  createTranslator(locale)(`archive.storage.${type}` as const);

export const getArchiveStatusLabel = (status: ArchiveStatus, locale: Locale): string =>
  createTranslator(locale)(`archive.status.${status}` as const);

export const getExportFormatLabel = (format: ExportFormat, locale: Locale): string =>
  createTranslator(locale)(`archive.format.${format}` as const);

export const DEFAULT_ARCHIVE_SETTINGS: Partial<ArchiveSettings> = {
  is_enabled: true,
  auto_archive_day: 1,
  leads_retention_days: 90,
  offers_retention_days: 90,
  email_logs_retention_days: 90,
  notifications_retention_days: 30,
  analytics_retention_days: 180,
  appointments_retention_days: 90,
  default_export_format: 'json',
  compress_archives: true,
  notify_on_archive: true,
};

