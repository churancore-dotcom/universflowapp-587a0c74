import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SEOHead = ({
  title = "Univers Flow - Free Music Streaming & Download | Listen Offline",
  description = "Stream and download unlimited music for free with Univers Flow. Discover millions of songs, create playlists, and listen offline. The best free music app by SHASHANK YADAV.",
  keywords = "free music streaming, music download, offline music, free songs, music app, Univers Flow, SHASHANK YADAV, listen music free, mp3 download, music player, playlist creator",
  image = "https://storage.googleapis.com/gpt-engineer-file-uploads/d6CK1hptEYS0iYCrQMmYcx7HukD2/social-images/social-1768315544947-Screenshot 2026-01-13 201134.png",
  url = "https://universflowapp.lovable.app",
  type = "website"
}: SEOHeadProps) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper to update or create meta tags
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Basic meta tags
    updateMeta('description', description);
    updateMeta('keywords', keywords);
    updateMeta('author', 'SHASHANK YADAV');
    updateMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMeta('googlebot', 'index, follow');
    
    // Open Graph
    updateMeta('og:title', title, true);
    updateMeta('og:description', description, true);
    updateMeta('og:image', image, true);
    updateMeta('og:url', url, true);
    updateMeta('og:type', type, true);
    updateMeta('og:site_name', 'Univers Flow', true);
    updateMeta('og:locale', 'en_US', true);

    // Twitter Card
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', title);
    updateMeta('twitter:description', description);
    updateMeta('twitter:image', image);
    updateMeta('twitter:creator', '@UniversFlow');

    // Additional SEO meta
    updateMeta('application-name', 'Univers Flow');
    updateMeta('apple-mobile-web-app-title', 'Univers Flow');
    updateMeta('mobile-web-app-capable', 'yes');
    updateMeta('apple-mobile-web-app-capable', 'yes');

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

  }, [title, description, keywords, image, url, type]);

  return null;
};

export default SEOHead;
