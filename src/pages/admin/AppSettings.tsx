import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Settings,
  Palette,
  Type,
  AlertTriangle,
  Save,
  RefreshCw,
  Eye,
  Wrench
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AppSettingRow {
  key: string;
  value: any;
  description: string | null;
}

const AppSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach((row: AppSettingRow) => {
        try {
          settingsMap[row.key] = typeof row.value === 'string' 
            ? JSON.parse(row.value) 
            : row.value;
        } catch {
          settingsMap[row.key] = row.value;
        }
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: update.value, updated_at: update.updated_at })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">App Settings</h1>
          <p className="text-muted-foreground">Control your app's appearance and behavior</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSettings} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={saveAllSettings} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branding */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="w-5 h-5 text-primary" />
                Branding
              </CardTitle>
              <CardDescription>Customize your app's identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="app_name">App Name</Label>
                <Input
                  id="app_name"
                  value={settings.app_name || ''}
                  onChange={(e) => updateSetting('app_name', e.target.value)}
                  placeholder="Your App Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app_tagline">Tagline</Label>
                <Input
                  id="app_tagline"
                  value={settings.app_tagline || ''}
                  onChange={(e) => updateSetting('app_tagline', e.target.value)}
                  placeholder="Your App Tagline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome_message">New User Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  value={settings.new_user_welcome_message || ''}
                  onChange={(e) => updateSetting('new_user_welcome_message', e.target.value)}
                  placeholder="Welcome message for new users"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Colors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent" />
                Colors
              </CardTitle>
              <CardDescription>Brand colors for the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="primary_color"
                    value={settings.primary_color || '#8B5CF6'}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color || '#8B5CF6'}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent_color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="accent_color"
                    value={settings.accent_color || '#D946EF'}
                    onChange={(e) => updateSetting('accent_color', e.target.value)}
                    className="w-14 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.accent_color || '#D946EF'}
                    onChange={(e) => updateSetting('accent_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <div className="flex gap-2">
                  <div 
                    className="w-20 h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: settings.primary_color || '#8B5CF6' }}
                  >
                    Primary
                  </div>
                  <div 
                    className="w-20 h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: settings.accent_color || '#D946EF' }}
                  >
                    Accent
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Maintenance Mode */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-yellow-400" />
                Maintenance Mode
              </CardTitle>
              <CardDescription>Take the app offline for maintenance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Maintenance Mode</p>
                  <p className="text-sm text-muted-foreground">Users will see a maintenance page</p>
                </div>
                <Switch
                  checked={settings.maintenance_mode || false}
                  onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)}
                />
              </div>
              {settings.maintenance_mode && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-400 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Warning</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maintenance mode is active. Users cannot access the app.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="maintenance_message">Maintenance Message</Label>
                <Textarea
                  id="maintenance_message"
                  value={settings.maintenance_message || ''}
                  onChange={(e) => updateSetting('maintenance_message', e.target.value)}
                  placeholder="Message to display during maintenance"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Upload Settings
              </CardTitle>
              <CardDescription>Configure file upload limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_upload_size">Maximum Upload Size (MB)</Label>
                <Input
                  id="max_upload_size"
                  type="number"
                  value={settings.max_upload_size_mb || 50}
                  onChange={(e) => updateSetting('max_upload_size_mb', parseInt(e.target.value))}
                  min={1}
                  max={500}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum file size for music uploads. Recommended: 50-100 MB
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AppSettings;
