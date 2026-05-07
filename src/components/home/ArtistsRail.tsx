import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, ChevronRight, Plus, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import {
  followArtist,
  getUserArtistPrefs,
  unfollowArtist,
  type UserArtistPref,
} from '@/lib/userArtistPrefs';
import { getFeaturedIndexedArtists } from '@/lib/indexedArtists';

interface DisplayArtist {
  key: string;
  name: string;
  image: string | null;
  followed: boolean;
}

const ArtistTile = memo(function ArtistTile({
  artist,
  index,
  large,
  onOpen,
  onToggleFollow,
}: {
  artist: DisplayArtist;
  index: number;
  large?: boolean;
  onOpen: () => void;
  onToggleFollow: () => void;
}) {
  const size = large ? 'w-[108px]' : 'w-[96px]';
  const img = large ? 'w-[108px] h-[108px]' : 'w-[96px] h-[96px]';
  return (
    <motion.div
      className={`flex-shrink-0 ${size} snap-start text-center`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
    >
      <button
        type="button"
        onClick={() => { triggerHaptic('selection'); onOpen(); }}
        className="relative block w-full"
      >
        <div
          className={`relative ${img} mx-auto rounded-full overflow-hidden bg-muted/40`}
          style={{ boxShadow: '0 8px 22px rgba(0,0,0,0.55)' }}
        >
          {artist.image ? (
            <img
              src={artist.image}
              alt={artist.name}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-accent/20">
              <User className="w-7 h-7 text-muted-foreground" />
            </div>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); triggerHaptic('impactLight'); onToggleFollow(); }}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: artist.followed ? 'hsl(var(--primary))' : 'rgba(0,0,0,0.85)',
              border: '2px solid hsl(var(--background))',
            }}
            aria-label={artist.followed ? 'Unfollow' : 'Follow'}
          >
            {artist.followed ? (
              <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
            ) : (
              <Plus className="w-3.5 h-3.5 text-foreground" strokeWidth={3} />
            )}
          </button>
        </div>
        <p className="mt-2.5 truncate text-[12.5px] font-semibold leading-tight text-foreground px-1">
          {artist.name}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {artist.followed ? 'Following' : 'Artist'}
        </p>
      </button>
    </motion.div>
  );
});

const ArtistsRail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [followedPrefs, setFollowedPrefs] = useState<UserArtistPref[]>([]);
  const [discover, setDiscover] = useState<DisplayArtist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefs, indexed] = await Promise.all([
          user ? getUserArtistPrefs(user.id) : Promise.resolve([] as UserArtistPref[]),
          getFeaturedIndexedArtists(20),
        ]);
        if (cancelled) return;
        setFollowedPrefs(prefs);
        const followedSet = new Set(prefs.map((p) => p.artist_name.toLowerCase()));
        const disc = indexed
          .filter((a) => !followedSet.has(a.name.toLowerCase()))
          .map((a) => ({ key: a.id, name: a.name, image: a.image_url || null, followed: false }));
        setDiscover(disc);
      } catch (e) {
        console.error('ArtistsRail load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleToggleFollow = async (name: string, image: string | null, currentlyFollowed: boolean) => {
    if (!user) { navigate('/auth'); return; }
    if (currentlyFollowed) {
      await unfollowArtist(user.id, name);
      setFollowedPrefs((prev) => prev.filter((p) => p.artist_name.toLowerCase() !== name.toLowerCase()));
      setDiscover((prev) => [{ key: name, name, image, followed: false }, ...prev]);
    } else {
      await followArtist(user.id, name, { image, source: 'lastfm' });
      setFollowedPrefs((prev) => [
        { id: name, artist_name: name, artist_image: image, artist_source: 'lastfm', created_at: new Date().toISOString() },
        ...prev,
      ]);
      setDiscover((prev) => prev.filter((a) => a.name.toLowerCase() !== name.toLowerCase()));
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-5 w-40 bg-muted/50 rounded animate-pulse mx-1" />
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-3 px-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[96px] flex-shrink-0">
              <div className="w-[96px] h-[96px] rounded-full bg-muted/50 animate-pulse" />
              <div className="h-3 mt-2 mx-2 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const followedDisplay: DisplayArtist[] = followedPrefs.map((p) => ({
    key: p.id,
    name: p.artist_name,
    image: p.artist_image,
    followed: true,
  }));

  return (
    <div className="space-y-7">
      {followedDisplay.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-extrabold tracking-tight">Your Artists</h2>
            <button
              onClick={() => { triggerHaptic('selection'); navigate('/artists'); }}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-muted-foreground"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1 -mx-3 px-3 snap-x">
            {followedDisplay.map((a, i) => (
              <ArtistTile
                key={a.key}
                artist={a}
                index={i}
                large
                onOpen={() => navigate(`/artists?focus=${encodeURIComponent(a.name)}`)}
                onToggleFollow={() => handleToggleFollow(a.name, a.image, true)}
              />
            ))}
          </div>
        </section>
      )}

      {discover.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-extrabold tracking-tight">
              {followedDisplay.length > 0 ? 'Discover Artists' : 'Popular Artists'}
            </h2>
            <button
              onClick={() => { triggerHaptic('selection'); navigate('/artists'); }}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-muted-foreground"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3.5 overflow-x-auto hide-scrollbar pb-1 -mx-3 px-3 snap-x">
            {discover.map((a, i) => (
              <ArtistTile
                key={a.key}
                artist={a}
                index={i}
                onOpen={() => navigate(`/artists?focus=${encodeURIComponent(a.name)}`)}
                onToggleFollow={() => handleToggleFollow(a.name, a.image, false)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default memo(ArtistsRail);
