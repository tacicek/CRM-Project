import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SEOGlobalSettings } from "@/types/websiteSettings";

// Default robots.txt content
const DEFAULT_ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /firma/
Disallow: /auth
Disallow: /embed/
Sitemap: https://offerio.ch/sitemap.xml`;

export default function RobotsTxt() {
  const [content, setContent] = useState<string>(DEFAULT_ROBOTS_TXT);

  useEffect(() => {
    const fetchRobotsTxt = async () => {
      try {
        const { data, error } = await supabase
          .from("website_settings")
          .select("setting_value")
          .eq("is_active", true)
          .eq("setting_key", "seo_global")
          .single();

        if (error) throw error;

        if (data?.setting_value) {
          const settings = data.setting_value as SEOGlobalSettings;
          if (settings.robots_txt) {
            setContent(settings.robots_txt);
          }
        }
      } catch (err) {
        console.error("Error fetching robots.txt:", err);
      }
    };

    fetchRobotsTxt();
  }, []);

  // Set content type to plain text
  useEffect(() => {
    document.body.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>`;
    document.title = "robots.txt";
  }, [content]);

  return null;
}

