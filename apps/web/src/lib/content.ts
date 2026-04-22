import { apiClient } from './api/client';

interface SiteContentItem {
  id: string;
  key: string;
  section: string;
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Fetch all content items for a given section.
 * Returns a key->content map for easy access.
 */
export async function fetchSectionContent(section: string): Promise<Record<string, string>> {
  try {
    const response = await apiClient.getContentBySection(section) as ApiResponse<SiteContentItem[]>;
    const map: Record<string, string> = {};
    for (const item of response.data || []) {
      if (item.content) {
        map[item.key] = item.content;
      }
    }
    return map;
  } catch {
    return {};
  }
}

