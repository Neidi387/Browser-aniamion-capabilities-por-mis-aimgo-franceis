import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function exportSceneToGlb(
	scene: THREE.Scene,
	animations: THREE.AnimationClip[]
): Promise<Blob> {
	const exporter = new GLTFExporter();
	const result = await exporter.parseAsync(scene, { binary: true, animations });
	const buffer = result as ArrayBuffer;
	return new Blob([buffer], { type: 'model/gltf-binary' });
}
