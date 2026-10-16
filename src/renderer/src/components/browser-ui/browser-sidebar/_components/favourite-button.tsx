import { memo, useCallback, useEffect, useState } from "react";
import { useAddressUrl, useFocusedTab } from "@/components/providers/tabs-provider";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export const FavouriteButton = memo(function FavouriteButton() {
  const addressUrl = useAddressUrl();
  const focusedTab = useFocusedTab();
  const [isFav, setIsFav] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isValidUrl = addressUrl && (addressUrl.startsWith("http://") || addressUrl.startsWith("https://"));

  useEffect(() => {
    if (!isValidUrl) {
      setIsFav(false);
      return;
    }

    lumi.favourites.isFavourite(addressUrl).then((favorited) => {
      setIsFav(favorited);
    });

    const unsub = lumi.favourites.onFavouritesChanged(() => {
      lumi.favourites.isFavourite(addressUrl).then((favorited) => {
        setIsFav(favorited);
      });
    });

    return () => {
      unsub();
    };
  }, [addressUrl, isValidUrl]);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isValidUrl) return;

      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      if (isFav) {
        await lumi.favourites.removeFavourite(addressUrl);
        setIsFav(false);
      } else {
        await lumi.favourites.addFavourite(focusedTab?.title || addressUrl, addressUrl, focusedTab?.faviconURL);
        setIsFav(true);
      }
    },
    [isValidUrl, isFav, addressUrl, focusedTab]
  );

  // Global Cmd+D listener for toggling bookmark
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && !e.shiftKey) {
        e.preventDefault();
        if (isValidUrl) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 300);
          if (isFav) {
            lumi.favourites.removeFavourite(addressUrl).then(() => setIsFav(false));
          } else {
            lumi.favourites
              .addFavourite(focusedTab?.title || addressUrl, addressUrl, focusedTab?.faviconURL)
              .then(() => setIsFav(true));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isValidUrl, isFav, addressUrl, focusedTab]);

  if (!isValidUrl) return null;

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      animate={{ scale: isAnimating ? 1.25 : 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      className={cn(
        "size-6 flex items-center justify-center rounded-md shrink-0 transition-colors cursor-pointer",
        isFav
          ? "text-amber-500 hover:bg-amber-500/15"
          : "text-black/40 dark:text-white/40 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-black/10 dark:hover:bg-white/10"
      )}
      title={isFav ? "Remove from Favourites (Cmd+D)" : "Add to Favourites (Cmd+D)"}
    >
      <Star className={cn("size-3.5 transition-all duration-200", isFav && "fill-amber-400 stroke-amber-500")} />
    </motion.button>
  );
});
