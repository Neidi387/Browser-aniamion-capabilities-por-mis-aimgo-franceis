import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneRig } from './types.js';

export function createScene(canvas: HTMLCanvasElement): SceneRig {
	const width = canvas.clientWidth || 800;
	const height = canvas.clientHeight || 600;

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(width, height, false);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x1a1a2e);

	const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
	camera.position.set(0, 0.8, 4.5);
	camera.lookAt(0, 0.3, 0);

	// Ambient fill
	scene.add(new THREE.AmbientLight(0xffffff, 0.4));

	// Warm key light
	const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
	keyLight.position.set(3, 5, 3);
	keyLight.castShadow = true;
	keyLight.shadow.mapSize.set(1024, 1024);
	scene.add(keyLight);

	// Cool rim/back fill
	const rimLight = new THREE.DirectionalLight(0xaad4ff, 0.3);
	rimLight.position.set(-2, 2, -3);
	scene.add(rimLight);

	// Ground plane
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(8, 8),
		new THREE.MeshPhongMaterial({ color: 0x2a2a4a })
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -0.54;
	ground.receiveShadow = true;
	scene.add(ground);

	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.minDistance = 1.5;
	controls.maxDistance = 10;
	controls.target.set(0, 0.3, 0);

	const clock = new THREE.Clock();

	return {
		renderer,
		scene,
		camera,
		controls,
		clock,
		dispose() {
			renderer.dispose();
			controls.dispose();
		}
	};
}

export function handleResize(rig: SceneRig, wrapper: HTMLElement): void {
	const w = wrapper.clientWidth;
	const h = wrapper.clientHeight;
	rig.camera.aspect = w / h;
	rig.camera.updateProjectionMatrix();
	rig.renderer.setSize(w, h, false);
}
