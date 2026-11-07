import { useEffect, useState } from 'react';
import { loadScene, presetScene, type LoadedScene, type Scene } from '../lib/scene';

/** Decodes the scene's pictures; keeps showing the previous scene until the new one is ready. */
export function useLoadedScene(scene: Scene): LoadedScene {
  const [loaded, setLoaded] = useState<LoadedScene>(() =>
    scene.background.type === 'preset' ? presetScene(scene.background.id) : presetScene('studio'),
  );
  useEffect(() => {
    let cancelled = false;
    loadScene(scene)
      .then((next) => !cancelled && setLoaded(next))
      .catch((error) => console.error('Could not load the background or logo', error));
    return () => {
      cancelled = true;
    };
  }, [scene]);
  return loaded;
}

/** Object URL for a blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}
