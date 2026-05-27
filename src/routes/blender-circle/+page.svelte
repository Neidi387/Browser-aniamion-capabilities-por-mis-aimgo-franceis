<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

	let canvas: HTMLCanvasElement;
	let rafId: number;
	let renderer: THREE.WebGLRenderer;

	onMount(() => {
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x111111);

		const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		camera.position.set(0, 1.5, 5);

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		renderer.setPixelRatio(devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);

		scene.add(new THREE.AmbientLight(0xffffff, 1.5));
		const dir = new THREE.DirectionalLight(0xffffff, 2);
		dir.position.set(5, 10, 5);
		scene.add(dir);

		let mixer: THREE.AnimationMixer;
		const clock = new THREE.Clock();

		const loader = new GLTFLoader();
		loader.load('/Jumping%20swuare.glb', (gltf) => {
			scene.add(gltf.scene);
			if (gltf.animations.length > 0) {
				mixer = new THREE.AnimationMixer(gltf.scene);
				mixer.clipAction(gltf.animations[0]).play();
			}
		});

		const controls = new OrbitControls(camera, canvas);
		controls.enableDamping = true;
		controls.minDistance = 1;
		controls.maxDistance = 20;

		const onResize = () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
		window.addEventListener('resize', onResize);

		const animate = () => {
			rafId = requestAnimationFrame(animate);
			controls.update();
			mixer?.update(clock.getDelta());
			renderer.render(scene, camera);
		};
		animate();

		return () => {
			window.removeEventListener('resize', onResize);
			controls.dispose();
		};
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		renderer?.dispose();
	});
</script>

<svelte:head><title>Jumping Square</title></svelte:head>

<canvas bind:this={canvas} style="width:100vw;height:100vh;display:block;"></canvas>
