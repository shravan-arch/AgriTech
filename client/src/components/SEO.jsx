import { useEffect } from 'react';

/**
 * SEO Head Management Component
 * Dynamically synchronizes document title, meta description, canonical URL,
 * robots directives, Open Graph, Twitter Cards, and JSON-LD structured data.
 */
export default function SEO({
  title = 'AgriTech - Smart Farm Management & Precision Agriculture Software',
  description = 'AgriTech is an all-in-one farm management platform offering GPS field boundary mapping, real-time IoT soil & weather telemetry, crop lifecycle scheduling, and farm supply inventory.',
  canonicalUrl = 'https://agritech-bay.vercel.app/',
  robots = 'index, follow',
  ogType = 'website',
  ogImage = 'https://agritech-bay.vercel.app/images/smart-drone-field.jpg',
  schema = null,
}) {
  useEffect(() => {
    // 1. Title
    if (title) {
      document.title = title;
    }

    // 2. Helper to set or update meta tags by name or property
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 3. Helper to set or update link tag (e.g. canonical)
    const setLinkTag = (rel, href) => {
      if (!href) return;
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute(rel, rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Primary Meta
    if (description) setMetaTag('name', 'description', description);
    if (robots) setMetaTag('name', 'robots', robots);
    if (canonicalUrl) setLinkTag('canonical', canonicalUrl);

    // Open Graph
    if (title) setMetaTag('property', 'og:title', title);
    if (description) setMetaTag('property', 'og:description', description);
    if (canonicalUrl) setMetaTag('property', 'og:url', canonicalUrl);
    if (ogType) setMetaTag('property', 'og:type', ogType);
    if (ogImage) setMetaTag('property', 'og:image', ogImage);

    // Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    if (title) setMetaTag('name', 'twitter:title', title);
    if (description) setMetaTag('name', 'twitter:description', description);
    if (ogImage) setMetaTag('name', 'twitter:image', ogImage);

    // Dynamic JSON-LD Structured Data
    const scriptId = 'dynamic-route-schema';
    let scriptEl = document.getElementById(scriptId);
    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, canonicalUrl, robots, ogType, ogImage, schema]);

  return null;
}
