import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Heart, 
  Search, 
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
  Calendar,
  Coffee,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Donation {
  id: string;
  user_id: string | null;
  amount: number;
  currency: string;
  platform: string;
  message: string | null;
  email: string | null;
  is_anonymous: boolean;
  created_at: string;
  username?: string;
}

interface Stats {
  totalDonations: number;
  totalAmount: number;
  donorCount: number;
  averageDonation: number;
  thisMonth: number;
}

const DonationHistory = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [stats, setStats] = useState<Stats>({
    totalDonations: 0,
    totalAmount: 0,
    donorCount: 0,
    averageDonation: 0,
    thisMonth: 0,
  });

  useEffect(() => {
    fetchDonations();

    // Realtime for donations
    const channel = supabase
      .channel('admin-donations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, fetchDonations)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDonations = async () => {
    setLoading(true);
    try {
      const { data: donationsData, error } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for non-anonymous donations
      const userIds = donationsData?.filter(d => d.user_id && !d.is_anonymous).map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enrichedDonations = donationsData?.map(donation => ({
        ...donation,
        username: donation.is_anonymous 
          ? 'Anonymous' 
          : profileMap.get(donation.user_id)?.username || donation.email || 'Unknown',
      })) || [];

      setDonations(enrichedDonations);

      // Calculate stats
      const totalAmount = enrichedDonations.reduce((sum, d) => sum + Number(d.amount), 0);
      const uniqueDonors = new Set(enrichedDonations.filter(d => d.user_id).map(d => d.user_id)).size;
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);
      const thisMonthDonations = enrichedDonations.filter(d => new Date(d.created_at) >= thisMonthStart);
      const thisMonthAmount = thisMonthDonations.reduce((sum, d) => sum + Number(d.amount), 0);

      setStats({
        totalDonations: enrichedDonations.length,
        totalAmount,
        donorCount: uniqueDonors,
        averageDonation: enrichedDonations.length > 0 ? totalAmount / enrichedDonations.length : 0,
        thisMonth: thisMonthAmount,
      });
    } catch (error) {
      console.error('Error fetching donations:', error);
      toast.error('Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      'kofi': 'bg-[#13C3FF]/20 text-[#13C3FF] border-[#13C3FF]/30',
      'buymeacoffee': 'bg-[#FFDD00]/20 text-[#FFDD00] border-[#FFDD00]/30',
      'paypal': 'bg-[#003087]/20 text-[#00457C] border-[#003087]/30',
      'default': 'bg-primary/20 text-primary border-primary/30',
    };
    
    const colorClass = colors[platform.toLowerCase()] || colors.default;
    
    return (
      <Badge className={colorClass}>
        <Coffee className="w-3 h-3 mr-1" />
        {platform}
      </Badge>
    );
  };

  const filteredDonations = donations.filter(donation => {
    const matchesSearch = 
      donation.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donation.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donation.message?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || donation.platform.toLowerCase() === platformFilter.toLowerCase();
    return matchesSearch && matchesPlatform;
  });

  const uniquePlatforms = [...new Set(donations.map(d => d.platform))];

  const statCards = [
    { label: 'Total Donations', value: stats.totalDonations.toString(), icon: Heart, color: 'text-red-400' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalAmount), icon: DollarSign, color: 'text-green-400' },
    { label: 'Unique Donors', value: stats.donorCount.toString(), icon: Users, color: 'text-blue-400' },
    { label: 'This Month', value: formatCurrency(stats.thisMonth), icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Donation History</h1>
          <p className="text-muted-foreground">View all donations and supporter contributions</p>
        </div>
        <Button onClick={fetchDonations} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {statCards.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Average Donation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Donation</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.averageDonation)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Platforms Used</p>
            <p className="text-lg font-semibold">{uniquePlatforms.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col md:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {uniquePlatforms.map(platform => (
              <SelectItem key={platform} value={platform.toLowerCase()}>{platform}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredDonations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Heart className="w-12 h-12 mb-4 opacity-50" />
            <p>No donations yet</p>
            <p className="text-sm">Donations will appear here once users start supporting</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead>Donor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations.map((donation) => (
                <TableRow key={donation.id} className="border-white/5">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Heart className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{donation.username}</p>
                        {donation.email && !donation.is_anonymous && (
                          <p className="text-xs text-muted-foreground">{donation.email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-green-400">
                      {formatCurrency(Number(donation.amount), donation.currency)}
                    </span>
                  </TableCell>
                  <TableCell>{getPlatformBadge(donation.platform)}</TableCell>
                  <TableCell>
                    <p className="max-w-48 truncate text-sm text-muted-foreground">
                      {donation.message || '-'}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(donation.created_at)}
                  </TableCell>
                  <TableCell>
                    {donation.is_anonymous ? (
                      <Badge variant="outline" className="gap-1">
                        <EyeOff className="w-3 h-3" />
                        Anonymous
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Eye className="w-3 h-3" />
                        Public
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Export hint */}
      {donations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-muted-foreground"
        >
          <p>Use the Backup & Export page to export donation data</p>
        </motion.div>
      )}
    </div>
  );
};

export default DonationHistory;
