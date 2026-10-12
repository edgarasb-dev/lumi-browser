import { GlobeIcon } from "lucide-react";
import { useState } from "react";

export function WebsiteFavicon({
  url,
  favicon,
  className,
  cacheOnly = false,
  onLoadedChange
}: {
  url: string;
  favicon?: string;
  className?: string;
  cacheOnly?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
}) {
  const [useLumiUtility, setUseLumiUtility] = useState(true);
  const [useCustomFavicon, setUseCustomFavicon] = useState(false);

  if (useLumiUtility) {
    const srcUrl = new URL("flow://favicon");
    srcUrl.searchParams.set("url", url);
    return (
      <img
        src={srcUrl.toString()}
        alt="Favicon"
        className={className}
        onLoad={() => onLoadedChange?.(true)}
        onError={() => {
          onLoadedChange?.(false);
          setUseLumiUtility(false);
          if (!cacheOnly && favicon) {
            setUseCustomFavicon(true);
          }
        }}
      />
    );
  }

  if (!cacheOnly && useCustomFavicon && favicon) {
    return (
      <img
        src={favicon}
        alt="Favicon"
        className={className}
        onLoad={() => onLoadedChange?.(true)}
        onError={() => {
          onLoadedChange?.(false);
          setUseCustomFavicon(false);
        }}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
    );
  }

  return <GlobeIcon className={className} />;
}
