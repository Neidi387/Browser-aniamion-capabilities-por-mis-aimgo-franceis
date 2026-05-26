import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface HumanFigure {
	root: THREE.Group;
	meshes: Record<string, THREE.Mesh>;
}

export interface AnimationRig {
	mixer: THREE.AnimationMixer;
	clip: THREE.AnimationClip;
}

export interface SceneRig {
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	controls: OrbitControls;
	clock: THREE.Clock;
	dispose(): void;
}
