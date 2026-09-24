import React from 'react';
import * as THREE from 'three';
import { emojiTexture } from './textures';

export interface EmojiMaterials {
  face: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
}

interface EmojiBodyProps {
  emoji: string;
  // Width/height of the glyph in world units.
  size?: number;
  // Total thickness of the stamped body.
  depth?: number;
  // Number of stacked slices. More reads as a smoother edge but costs a draw
  // call each; fighters use ~10, background confetti a handful.
  layers?: number;
  // Colour of the side walls / outline.
  rimColor?: THREE.ColorRepresentation;
  onMaterials?: (m: EmojiMaterials) => void;
}

const plane = new THREE.PlaneGeometry(1, 1);

// A "cookie-cutter" 3D emoji: the glyph is stamped out of a stack of
// alpha-tested slices. The two outer slices carry the full-colour art (the back
// one reads mirrored, which is exactly how the fighter looks after turning
// around); the inner slices are tinted dark and slightly oversized, so they
// form the body's side walls and a cartoon outline from the front.
export function EmojiBody({ emoji, size = 1, depth = 0.3, layers = 8, rimColor = '#1b1b24', onMaterials }: EmojiBodyProps) {
  const materials = React.useMemo<EmojiMaterials>(() => {
    const map = emojiTexture(emoji);
    const face = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0,
      // A little self-illumination from the art itself keeps emoji colours
      // vivid under coloured stage lighting.
      emissiveMap: map,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.3,
    });
    const rim = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      color: new THREE.Color(rimColor),
      roughness: 0.8,
      metalness: 0,
    });
    return { face, rim };
  }, [emoji, rimColor]);

  React.useEffect(() => {
    onMaterials?.(materials);
    return () => {
      materials.face.dispose();
      materials.rim.dispose();
    };
    // onMaterials is a ref-setter callback; only re-run when the materials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  const slices = Math.max(2, layers);
  const items = [];
  for (let i = 0; i < slices; i++) {
    const t = i / (slices - 1); // 0 = back, 1 = front
    const z = (t - 0.5) * depth;
    const outer = i === 0 || i === slices - 1;
    // Inner slices bulge slightly for a rounded, outlined silhouette.
    const bulge = outer ? 1 : 1.035 + Math.sin(t * Math.PI) * 0.02;
    items.push(
      <mesh
        key={i}
        geometry={plane}
        material={outer ? materials.face : materials.rim}
        position={[0, 0, z]}
        scale={[size * bulge, size * bulge, 1]}
      />
    );
  }
  return <group>{items}</group>;
}
