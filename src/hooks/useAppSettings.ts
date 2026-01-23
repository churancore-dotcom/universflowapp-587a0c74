import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  app_name: string;
  app_tagline: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  primary_color: string;
  accent_color: string;
  feature_downloads: boolean;
  feature_comments: boolean;
  feature_social_sharing: boolean;
  feature_lyrics: boolean;
  feature_dedications: boolean;
  feature_reactions: boolean;
  ads_enabled: boolean;
  ads_frequency: number;
  max_upload_size_mb: number;
  new_user_welcome_message: string;
}

const defaultSettings: AppSettings = {
  app_name: 'Univers Flow',
  app_tagline: 'Your Music Universe',
  maintenance_mode: false,
  maintenance_message: 'We are updating the app. Please check back soon!',
  primary_color: '#8B5CF6',
  accent_color: '#D946EF',
  feature_downloads: true,
  feature_comments: true,
  feature_social_sharing: true,
  feature_lyrics: true,
  feature_dedications: true,
  feature_reactions: true,
  ads_enabled: true,
  ads_frequency: 5,
  max_upload_size_mb: 50,
  new_user_welcome_message: 'Welcome to Univers Flow! Start exploring music now.',
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const settingsMap: Record<string, any> = {};
        data.forEach((row) => {
          const key = row.key;
          try {
            settingsMap[key] = typeof row.value === 'string' 
              ? JSON.parse(row.value) 
              : row.value;
          } catch {
            settingsMap[key] = row.value;
          }
        });
        setSettings({ ...defaultSettings, ...settingsMap } as AppSettings);
      }
    } catch (error) {
      console.error('Error fetching app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        })
        .eq('key', key);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      return { success: true };
    } catch (error) {
      console.error('Error updating setting:', error);
      return { success: false, error };
    }
  };

  const isFeatureEnabled = (feature: keyof AppSettings): boolean => {
    return settings[feature] as boolean;
  };

  return {
    settings,
    loading,
    updateSetting,
    isFeatureEnabled,
    refetch: fetchSettings,
  };
};

export type { AppSettings };
