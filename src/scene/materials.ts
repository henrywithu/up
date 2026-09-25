import * as THREE from 'three';

const gradient = new THREE.DataTexture(new Uint8Array([214, 244, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;

export function paperMaterial(map?: THREE.Texture | null) {
  return new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient, ...(map ? { map } : {}) });
}

/** Inverted hull outline, matching the normal-expanded meshes in the reference renderer. */
export function outlineGeometry(geometry: THREE.BufferGeometry, thickness: number) {
  const clone = geometry.clone();
  const positions = clone.getAttribute('position');
  const normals = clone.getAttribute('normal');
  if (!normals) return clone;
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i,
      positions.getX(i) + normals.getX(i) * thickness,
      positions.getY(i) + normals.getY(i) * thickness,
      positions.getZ(i) + normals.getZ(i) * thickness);
  }
  positions.needsUpdate = true;
  clone.computeBoundingSphere();
  clone.deleteAttribute('uv');
  return clone;
}
