// =============================================================================
// DATA ARCHIVING UTILITIES
// Functions for exporting, archiving, and restoring data
// =============================================================================

import { supabase } from "@/integrations/supabase/client";
import {
  ArchiveType,
  ArchiveLog,
  ArchiveSettings,
  ArchiveStatistics,
  CreateArchiveRequest,
  CreateArchiveResponse,
  ArchiveExportFile,
} from "@/types/archive";

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch archive settings
 * Returns null if no settings exist (which is a valid state for new installations)
 */
export async function getArchiveSettings(): Promise<ArchiveSettings | null> {
  const { data, error } = await supabase
    .from('archive_settings')
    .select('*')
    .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 error when no rows

  if (error) {
    // Only log actual errors, not "no rows found"
    if (error.code !== 'PGRST116') {
      console.error('Error fetching archive settings:', error);
    }
    return null;
  }

  return data as ArchiveSettings | null;
}

/**
 * Update archive settings
 */
export async function updateArchiveSettings(
  settings: Partial<ArchiveSettings>
): Promise<boolean> {
  const { error } = await supabase
    .from('archive_settings')
    .update(settings)
    .eq('id', settings.id);

  if (error) {
    console.error('Error updating archive settings:', error);
    return false;
  }

  return true;
}

/**
 * Fetch archive logs with pagination
 */
export async function getArchiveLogs(
  page: number = 1,
  pageSize: number = 10,
  archiveType?: ArchiveType
): Promise<{ logs: ArchiveLog[]; total: number }> {
  let query = supabase
    .from('archive_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (archiveType) {
    query = query.eq('archive_type', archiveType);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching archive logs:', error);
    return { logs: [], total: 0 };
  }

  return {
    logs: (data || []) as ArchiveLog[],
    total: count || 0,
  };
}

/**
 * Fetch archive statistics
 */
export async function getArchiveStatistics(): Promise<ArchiveStatistics[]> {
  const { data, error } = await supabase.rpc('get_archive_statistics');

  if (error) {
    console.error('Error fetching archive statistics:', error);
    return [];
  }

  return data as ArchiveStatistics[];
}

// =============================================================================
// DATA EXPORT FUNCTIONS
// =============================================================================

/**
 * Fetch leads data for archiving
 */
async function fetchLeadsForArchive(retentionDays: number): Promise<Record<string, unknown>[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      lead_distributions (*),
      offers (
        *,
        offer_items (*)
      )
    `)
    .lt('created_at', cutoffDate.toISOString())
    .in('status', ['completed', 'cancelled', 'expired', 'rejected']);

  if (error) {
    console.error('Error fetching leads for archive:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch offers data for archiving
 */
async function fetchOffersForArchive(retentionDays: number): Promise<Record<string, unknown>[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('offers')
    .select(`
      *,
      offer_items (*)
    `)
    .lt('created_at', cutoffDate.toISOString())
    .in('status', ['sent', 'accepted', 'rejected', 'expired']);

  if (error) {
    console.error('Error fetching offers for archive:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch email logs for archiving
 */
async function fetchEmailLogsForArchive(retentionDays: number): Promise<Record<string, unknown>[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error fetching email logs for archive:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch notifications for archiving
 */
async function fetchNotificationsForArchive(retentionDays: number): Promise<Record<string, unknown>[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .lt('created_at', cutoffDate.toISOString())
    .eq('read', true);

  if (error) {
    console.error('Error fetching notifications for archive:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch appointments for archiving
 */
async function fetchAppointmentsForArchive(retentionDays: number): Promise<Record<string, unknown>[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_history (*)
    `)
    .lt('created_at', cutoffDate.toISOString())
    .in('status', ['completed', 'cancelled']);

  if (error) {
    console.error('Error fetching appointments for archive:', error);
    return [];
  }

  return data || [];
}

// =============================================================================
// EXPORT FORMAT CONVERTERS
// =============================================================================

/**
 * Convert data to JSON string
 */
function toJSON(data: Record<string, unknown>[], archiveType: ArchiveType): string {
  const exportFile: ArchiveExportFile = {
    version: '1.0',
    export_date: new Date().toISOString(),
    archive_type: archiveType,
    total_records: data.length,
    data_from: data.length > 0 ? String(data[data.length - 1]?.created_at || '') : '',
    data_to: data.length > 0 ? String(data[0]?.created_at || '') : '',
    checksum: generateChecksum(JSON.stringify(data)),
    data,
  };

  return JSON.stringify(exportFile, null, 2);
}

/**
 * Convert data to CSV string
 */
function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  // Get all unique keys from all objects
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      // Skip nested objects/arrays for CSV
      if (typeof item[key] !== 'object' || item[key] === null) {
        allKeys.add(key);
      }
    });
  });

  const headers = Array.from(allKeys);
  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const values = headers.map(header => {
      const value = item[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') {
        // Escape quotes and wrap in quotes
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Generate simple checksum for data integrity
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// =============================================================================
// MAIN ARCHIVE FUNCTIONS
// =============================================================================

/**
 * Create archive and return downloadable data
 */
export async function createArchive(
  request: CreateArchiveRequest
): Promise<CreateArchiveResponse> {
  try {
    const settings = await getArchiveSettings();
    const retentionDays = request.retention_days || 
      (settings ? getRetentionDays(settings, request.archive_type) : 90);

    // Fetch data based on archive type
    let data: Record<string, unknown>[] = [];
    
    switch (request.archive_type) {
      case 'leads':
        data = await fetchLeadsForArchive(retentionDays);
        break;
      case 'offers':
        data = await fetchOffersForArchive(retentionDays);
        break;
      case 'email_logs':
        data = await fetchEmailLogsForArchive(retentionDays);
        break;
      case 'notifications':
        data = await fetchNotificationsForArchive(retentionDays);
        break;
      case 'appointments':
        data = await fetchAppointmentsForArchive(retentionDays);
        break;
      case 'full_backup': {
        // Fetch all types
        const [leads, offers, emails, notifs, appts] = await Promise.all([
          fetchLeadsForArchive(retentionDays),
          fetchOffersForArchive(retentionDays),
          fetchEmailLogsForArchive(retentionDays),
          fetchNotificationsForArchive(retentionDays),
          fetchAppointmentsForArchive(retentionDays),
        ]);
        data = [
          { type: 'leads', data: leads },
          { type: 'offers', data: offers },
          { type: 'email_logs', data: emails },
          { type: 'notifications', data: notifs },
          { type: 'appointments', data: appts },
        ] as unknown as Record<string, unknown>[];
        break;
      }
      default:
        return { success: false, error: 'Unbekannter Archivtyp' };
    }

    if (data.length === 0) {
      return { 
        success: true, 
        records_archived: 0,
        error: 'Keine Daten zum Archivieren gefunden'
      };
    }

    // Convert to requested format
    const exportFormat = request.export_format || settings?.default_export_format || 'json';
    let exportData: string;
    let mimeType: string;
    let fileExtension: string;

    if (exportFormat === 'csv') {
      exportData = toCSV(data);
      mimeType = 'text/csv';
      fileExtension = 'csv';
    } else {
      exportData = toJSON(data, request.archive_type);
      mimeType = 'application/json';
      fileExtension = 'json';
    }

    const fileSizeBytes = new Blob([exportData]).size;
    const archiveName = request.custom_name || 
      `archive_${request.archive_type}_${new Date().toISOString().split('T')[0]}`;

    // Create archive log entry
    const { data: currentUser } = await supabase.auth.getUser();
    
    const { data: logData, error: logError } = await supabase
      .from('archive_logs')
      .insert({
        archive_name: archiveName,
        archive_type: request.archive_type,
        records_archived: data.length,
        file_size_bytes: fileSizeBytes,
        storage_type: request.storage_type,
        storage_path: `${archiveName}.${fileExtension}`,
        export_format: exportFormat,
        triggered_by: 'manual',
        triggered_by_user_id: currentUser?.user?.id,
        data_from_date: data.length > 0 ? String(data[data.length - 1]?.created_at || new Date().toISOString()) : null,
        data_to_date: data.length > 0 ? String(data[0]?.created_at || new Date().toISOString()) : null,
        status: 'completed',
        source_data_deleted: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating archive log:', logError);
    }

    // Create downloadable blob URL
    const blob = new Blob([exportData], { type: mimeType });
    const downloadUrl = URL.createObjectURL(blob);

    // Delete source data if requested
    if (request.delete_after_archive) {
      await deleteArchivedData(request.archive_type, retentionDays);
      
      // Update log to mark data as deleted
      if (logData) {
        await supabase
          .from('archive_logs')
          .update({ 
            source_data_deleted: true, 
            deleted_at: new Date().toISOString() 
          })
          .eq('id', logData.id);
      }
    }

    return {
      success: true,
      archive_id: logData?.id,
      records_archived: data.length,
      file_size_bytes: fileSizeBytes,
      download_url: downloadUrl,
    };

  } catch (error) {
    console.error('Error creating archive:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Delete archived data from source tables
 */
async function deleteArchivedData(
  archiveType: ArchiveType,
  retentionDays: number
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  switch (archiveType) {
    case 'leads':
      // First delete related records
      await supabase
        .from('lead_distributions')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      
      // Then delete leads
      await supabase
        .from('leads')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['completed', 'cancelled', 'expired', 'rejected']);
      break;

    case 'offers': {
      // First delete offer items
      const { data: oldOffers } = await supabase
        .from('offers')
        .select('id')
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['sent', 'accepted', 'rejected', 'expired']);

      if (oldOffers && oldOffers.length > 0) {
        const offerIds = oldOffers.map(o => o.id);
        await supabase
          .from('offer_items')
          .delete()
          .in('offer_id', offerIds);
      }

      await supabase
        .from('offers')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['sent', 'accepted', 'rejected', 'expired']);
      break;
    }

    case 'email_logs':
      await supabase
        .from('email_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      break;

    case 'notifications':
      await supabase
        .from('notifications')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .eq('read', true);
      break;

    case 'appointments': {
      // First delete appointment history
      const { data: oldAppointments } = await supabase
        .from('appointments')
        .select('id')
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['completed', 'cancelled']);

      if (oldAppointments && oldAppointments.length > 0) {
        const appointmentIds = oldAppointments.map(a => a.id);
        await supabase
          .from('appointment_history')
          .delete()
          .in('appointment_id', appointmentIds);
      }

      await supabase
        .from('appointments')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['completed', 'cancelled']);
      break;
    }
  }
}

/**
 * Get retention days from settings based on archive type
 */
function getRetentionDays(settings: ArchiveSettings, archiveType: ArchiveType): number {
  switch (archiveType) {
    case 'leads':
      return settings.leads_retention_days;
    case 'offers':
      return settings.offers_retention_days;
    case 'email_logs':
      return settings.email_logs_retention_days;
    case 'notifications':
      return settings.notifications_retention_days;
    case 'analytics':
      return settings.analytics_retention_days;
    case 'appointments':
      return settings.appointments_retention_days;
    default:
      return 90;
  }
}

// =============================================================================
// DOWNLOAD HELPERS
// =============================================================================

/**
 * Trigger file download in browser
 */
export function downloadFile(
  data: string,
  filename: string,
  mimeType: string = 'application/json'
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date for display
 */
export function formatArchiveDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

