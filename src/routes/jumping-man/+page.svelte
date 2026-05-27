<svelte:head>
	<title>Jumping Man</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

	let canvas: HTMLCanvasElement;

	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let animationId: number;

	let manGroup: THREE.Group;
	let manMaterial: THREE.MeshStandardMaterial;
	let headMesh: THREE.Mesh | null = null;

	let audioCtx: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let micStream: MediaStream | null = null;
	let audioData: Uint8Array<ArrayBuffer> = new Uint8Array(0) as Uint8Array<ArrayBuffer>;

	let currentHeadScale = 1.0;

	const REST_NOISE = 0.03;
	const GROW_THRESHOLD = 0.06;
	const MAX_HEAD_SCALE = 2.5;
	const GROW_RATE = 0.08;
	const DECAY_FAST = 0.04;
	const DECAY_SLOW = 0.01;

	const manBaseY = 0;
	let manCurrentY = 0;
	let velocityY = 0;
	const GRAVITY = -0.015;
	const JUMP_VELOCITY = 0.35;
	const SHAKE_THRESHOLD = 15;
	const SHAKE_COOLDOWN_MS = 500;
	let lastShakeTime = 0;

	let scrollT = 0;
	const colorGreen = new THREE.Color(0x00ff00);
	const colorRed = new THREE.Color(0xff0000);
	const lerpedColor = new THREE.Color();

	let baselineBeta: number | null = null;
	let baselineGamma: number | null = null;

	let gyroHandler: ((e: DeviceOrientationEvent) => void) | null = null;
	let motionHandler: ((e: DeviceMotionEvent) => void) | null = null;

	const DEG2RAD = Math.PI / 180;

	function initScene() {
		renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a2e);

		camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
		camera.position.set(0, 4, 10);
		camera.lookAt(0, 1, 0);

		scene.add(new THREE.AmbientLight(0xffffff, 0.5));
		const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
		dirLight.position.set(5, 10, 5);
		dirLight.castShadow = true;
		scene.add(dirLight);

		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(20, 20),
			new THREE.MeshStandardMaterial({ color: 0x444444 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.receiveShadow = true;
		scene.add(ground);

		const wallMat = new THREE.MeshStandardMaterial({ color: 0x223366, side: THREE.DoubleSide });
		const wallGeo = new THREE.PlaneGeometry(10, 5);

		const wallLeft = new THREE.Mesh(wallGeo, wallMat);
		wallLeft.position.set(-8, 2.5, 0);
		wallLeft.rotation.y = Math.PI / 2;
		scene.add(wallLeft);

		const wallRight = new THREE.Mesh(wallGeo, wallMat);
		wallRight.position.set(8, 2.5, 0);
		wallRight.rotation.y = -Math.PI / 2;
		scene.add(wallRight);

		manMaterial = new THREE.MeshStandardMaterial({ color: colorGreen });
		manGroup = new THREE.Group();
		manGroup.position.set(0, manBaseY, 0);
		scene.add(manGroup);

		new GLTFLoader().load('/man.gltf', (gltf) => {
			const model = gltf.scene;
			let maxY = -Infinity;
			model.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.material = manMaterial;
					obj.castShadow = true;
					obj.geometry.computeBoundingBox();
					const cy = obj.geometry.boundingBox!.getCenter(new THREE.Vector3()).y;
					if (cy > maxY) { maxY = cy; headMesh = obj; }
				}
			});
			manGroup.add(model);
		});
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		lerpedColor.lerpColors(colorGreen, colorRed, scrollT);
		manMaterial.color.copy(lerpedColor);

		if (velocityY !== 0 || manCurrentY > manBaseY) {
			velocityY += GRAVITY;
			manCurrentY += velocityY;
			if (manCurrentY <= manBaseY) {
				manCurrentY = manBaseY;
				velocityY = 0;
			}
			manGroup.position.y = manCurrentY;
		}

		let volume = 0;
		if (analyser && audioData.length > 0) {
			analyser.getByteTimeDomainData(audioData);
			let sumSq = 0;
			for (const v of audioData) { const n = (v - 128) / 128; sumSq += n * n; }
			volume = Math.sqrt(sumSq / audioData.length);
		}

		let targetScale: number;
		let lerpRate: number;
		if (volume > GROW_THRESHOLD) {
			const t = Math.min((volume - GROW_THRESHOLD) / (0.3 - GROW_THRESHOLD), 1);
			targetScale = 1.0 + t * (MAX_HEAD_SCALE - 1.0);
			lerpRate = GROW_RATE;
		} else if (volume < REST_NOISE) {
			targetScale = 1.0;
			lerpRate = DECAY_FAST;
		} else {
			targetScale = 1.0;
			lerpRate = DECAY_SLOW;
		}
		currentHeadScale += (targetScale - currentHeadScale) * lerpRate;
		if (headMesh) headMesh.scale.setScalar(currentHeadScale);

		renderer.render(scene, camera);
	}

	function onScroll() {
		scrollT = Math.min(Math.max(window.scrollY / 1000, 0), 1);
	}

	function onResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	async function setupMicrophone() {
		if (!navigator.mediaDevices?.getUserMedia) return;
		try {
			micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioCtx = new AudioContext();
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			audioCtx.createMediaStreamSource(micStream).connect(analyser);
			audioData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
		} catch { /* permission denied or no mic */ }
	}

	async function setupGyroscope() {
		if (typeof DeviceOrientationEvent === 'undefined') return;

		const handler = (e: DeviceOrientationEvent) => {
			if (baselineBeta === null) {
				baselineBeta = e.beta ?? 0;
				baselineGamma = e.gamma ?? 0;
				return;
			}
			manGroup.rotation.x = ((e.beta ?? 0) - baselineBeta) * DEG2RAD;
			manGroup.rotation.z = ((e.gamma ?? 0) - (baselineGamma ?? 0)) * DEG2RAD;
		};

		type PermissionedEvent = { requestPermission?: () => Promise<string> };
		if (typeof (DeviceOrientationEvent as unknown as PermissionedEvent).requestPermission === 'function') {
			try {
				const perm = await (DeviceOrientationEvent as unknown as Required<PermissionedEvent>).requestPermission();
				if (perm === 'granted') window.addEventListener('deviceorientation', handler);
			} catch { /* permission denied */ }
		} else {
			window.addEventListener('deviceorientation', handler);
		}

		gyroHandler = handler;
	}

	function setupMotion() {
		if (typeof DeviceMotionEvent === 'undefined') return;

		const handler = (e: DeviceMotionEvent) => {
			const acc = e.accelerationIncludingGravity;
			if (!acc) return;
			const mag = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
			if (mag > SHAKE_THRESHOLD) {
				const now = Date.now();
				if (now - lastShakeTime > SHAKE_COOLDOWN_MS && manCurrentY <= manBaseY + 0.01) {
					lastShakeTime = now;
					velocityY = JUMP_VELOCITY;
				}
			}
		};

		window.addEventListener('devicemotion', handler);
		motionHandler = handler;
	}

	onMount(() => {
		initScene();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		setupGyroscope();
		setupMotion();
		setupMicrophone();
		document.body.style.height = '2000px';
		animate();
	});

	onDestroy(() => {
		cancelAnimationFrame(animationId);
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onResize);
		if (gyroHandler) window.removeEventListener('deviceorientation', gyroHandler);
		if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
		micStream?.getTracks().forEach(t => t.stop());
		audioCtx?.close();
		scene?.traverse((obj) => {
			if (obj instanceof THREE.Mesh) obj.geometry.dispose();
		});
		manMaterial?.dispose();
		renderer?.dispose();
		document.body.style.height = '';
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		display: block;
		touch-action: none;
		pointer-events: none;
	}
</style>
