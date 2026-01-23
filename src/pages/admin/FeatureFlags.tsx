import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ToggleLeft,
  Download,
  MessageSquare,
  Share2,
  Music2,
  Heart,
  Smile,
  Megaphone,
  RefreshCw,
  Save,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  enabled: boolean;
}

const FeatureFlags = () => {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [adsFrequency, setAdsFrequency] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const featureDefinitions = [
    { key: 'feature_downloads', label: 'Downloads', description: 'Allow users to download songs for offline listening', icon: Download, color: 'text-blue-400' },
    { key: 'feature_comments', label: 'Comments', description: 'Allow users to comment on songs', icon: MessageSquare, color: 'text-green-400' },
    { key: 'feature_social_sharing', label: 'Social Sharing', description: 'Allow users to share songs to social media', icon: Share2, color: 'text-purple-400' },
    { key: 'feature_lyrics', label: 'Lyrics Display', description: 'Show lyrics during playback', icon: Music2, color: 'text-pink-400' },
    { key: 'feature_dedications', label: 'Song Dedications', description: 'Allow users to dedicate songs to friends', icon: Heart, color: 'text-red-400' },
    { key: 'feature_reactions', label: 'Song Reactions', description: 'Allow users to react to songs with emojis', icon: Smile, color: 'text-yellow-400' },
    { key: 'ads_enabled', label: 'Advertisements', description: 'Show ads to free users', icon: Megaphone, color: 'text-orange-400' },
  ];

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [...featureDefinitions.map(f => f.key), 'ads_frequency']);

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach((row) => {
        try {
          settingsMap[row.key] = JSON.parse(row.value as string);
        } catch {
          settingsMap[row.key] = row.value;
        }
      });

      const mappedFeatures = featureDefinitions.map(def => ({
        ...def,
        enabled: settingsMap[def.key] ?? true,
      }));

      setFeatures(mappedFeatures);
      setAdsFrequency(settingsMap.ads_frequency ?? 5);
    } catch (error) {
      console.error('Error fetching features:', error);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (key: string) => {
    setFeatures(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const updates = features.map(f => ({
        key: f.key,
        value: JSON.stringify(f.enabled),
      }));

      // Add ads_frequency
      updates.push({
        key: 'ads_frequency',
        value: JSON.stringify(adsFrequency),
      });

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: update.value, updated_at: new Date().toISOString() })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast.success('Feature flags saved');
    } catch (error) {
      console.error('Error saving features:', error);
      toast.error('Failed to save feature flags');
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

  const enabledCount = features.filter(f => f.enabled).length;
  const adsEnabled = features.find(f => f.key === 'ads_enabled')?.enabled;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">Enable or disable app features instantly</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchFeatures} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={saveAll} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Features</p>
              <p className="text-2xl font-bold">{enabledCount} / {features.length}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Quick Toggle</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFeatures(prev => prev.map(f => ({ ...f, enabled: true })))}
            >
              Enable All
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className={`glass border-white/10 transition-all ${feature.enabled ? 'border-primary/30' : 'opacity-70'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 ${feature.color}`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{feature.label}</p>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={() => toggleFeature(feature.key)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Ads Configuration */}
      {adsEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-400" />
                Ad Configuration
              </CardTitle>
              <CardDescription>Configure how often ads are shown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="ads_frequency">Show ad after every N songs</Label>
                <Input
                  id="ads_frequency"
                  type="number"
                  value={adsFrequency}
                  onChange={(e) => setAdsFrequency(parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Free users will see an ad after every {adsFrequency} songs
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default FeatureFlags;
