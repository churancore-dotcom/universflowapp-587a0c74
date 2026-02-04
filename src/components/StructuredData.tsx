import { useEffect } from 'react';

const StructuredData = () => {
  useEffect(() => {
    // Remove existing structured data
    const existing = document.querySelectorAll('script[type="application/ld+json"]');
    existing.forEach(el => el.remove());

    // Organization Schema
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Univers Flow",
      "url": "https://universflowapp.lovable.app",
      "logo": "https://storage.googleapis.com/gpt-engineer-file-uploads/d6CK1hptEYS0iYCrQMmYcx7HukD2/uploads/1768315312999-Screenshot 2026-01-13 201134.png",
      "description": "Premium free music streaming platform by SHASHANK YADAV",
      "founder": {
        "@type": "Person",
        "name": "SHASHANK YADAV"
      },
      "sameAs": [
        "https://twitter.com/UniversFlow"
      ]
    };

    // WebApplication Schema
    const webAppSchema = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Univers Flow",
      "url": "https://universflowapp.lovable.app",
      "description": "Stream and download unlimited music for free. Discover millions of songs, create playlists, and listen offline.",
      "applicationCategory": "MusicApplication",
      "operatingSystem": "Web, Android, iOS",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Person",
        "name": "SHASHANK YADAV"
      },
      "featureList": [
        "Free music streaming",
        "Offline music download",
        "Playlist creation",
        "High quality audio",
        "No ads for premium",
        "Cross-platform sync"
      ],
      "screenshot": "https://storage.googleapis.com/gpt-engineer-file-uploads/d6CK1hptEYS0iYCrQMmYcx7HukD2/social-images/social-1768315544947-Screenshot 2026-01-13 201134.png"
    };

    // MusicGroup / Music Streaming Service Schema
    const musicServiceSchema = {
      "@context": "https://schema.org",
      "@type": "MusicStreamingService",
      "name": "Univers Flow",
      "url": "https://universflowapp.lovable.app",
      "description": "The best free music streaming app. Listen to millions of songs, discover new artists, and download music for offline listening.",
      "provider": {
        "@type": "Person",
        "name": "SHASHANK YADAV"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free tier with optional premium features"
      }
    };

    // FAQ Schema for common questions
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is Univers Flow free to use?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! Univers Flow is completely free to use. You can stream unlimited music, create playlists, and download songs for offline listening without paying anything."
          }
        },
        {
          "@type": "Question",
          "name": "Can I download music for offline listening?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Absolutely! Univers Flow allows you to download any song directly to your device for offline listening. No internet connection required once downloaded."
          }
        },
        {
          "@type": "Question",
          "name": "Who created Univers Flow?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Univers Flow was designed and developed by SHASHANK YADAV as a premium music streaming experience for everyone."
          }
        },
        {
          "@type": "Question",
          "name": "What devices support Univers Flow?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Univers Flow works on all modern web browsers, Android devices, and iOS devices. It's a Progressive Web App (PWA) that you can install on any device."
          }
        }
      ]
    };

    // BreadcrumbList Schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://universflowapp.lovable.app/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Search Music",
          "item": "https://universflowapp.lovable.app/search"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "My Library",
          "item": "https://universflowapp.lovable.app/library"
        }
      ]
    };

    // Add all schemas to the page
    const schemas = [organizationSchema, webAppSchema, musicServiceSchema, faqSchema, breadcrumbSchema];
    
    schemas.forEach(schema => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(el => el.remove());
    };
  }, []);

  return null;
};

export default StructuredData;
