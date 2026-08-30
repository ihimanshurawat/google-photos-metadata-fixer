import { invoke } from '@tauri-apps/api/core';

/**
 * Logs a structured UI interaction or page-level event to the persistent local diagnostic log.
 */
export async function logUiEvent(
  category: string,
  action: string,
  details?: Record<string, any> | string | null
): Promise<void> {
  try {
    const detailStr = details
      ? typeof details === 'string'
        ? details
        : JSON.stringify(details)
      : '';

    await invoke('log_ui_event', {
      category,
      action,
      details: detailStr,
    });
  } catch (err) {
    console.debug('[UI Event]', category, action, details);
  }
}
