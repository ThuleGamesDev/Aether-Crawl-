import { collectAssetPaths } from '../data/assetRegistry';

const loadedImages = new Map<string, HTMLImageElement>();
const pendingLoads = new Map<string, Promise<HTMLImageElement>>();

export const preloadImageAsset = (path: string): Promise<HTMLImageElement> => {
  const loaded = loadedImages.get(path);
  if (loaded?.complete && loaded.naturalWidth > 0) return Promise.resolve(loaded);
  const pending = pendingLoads.get(path);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      loadedImages.set(path, image);
      pendingLoads.delete(path);
      resolve(image);
    };
    image.onerror = () => {
      pendingLoads.delete(path);
      reject(new Error(`Required game asset failed to load: ${path}`));
    };
    loadedImages.set(path, image);
    image.src = path;
  });

  pendingLoads.set(path, promise);
  return promise;
};

export const preloadAssets = async (paths: string[] = collectAssetPaths()): Promise<void> => {
  await Promise.all(paths.map(preloadImageAsset));
};

export const getImageAsset = (path: string): HTMLImageElement | null => {
  const image = loadedImages.get(path);
  return image?.complete && image.naturalWidth > 0 ? image : null;
};

export const loadedAssetCount = (): number => loadedImages.size;
