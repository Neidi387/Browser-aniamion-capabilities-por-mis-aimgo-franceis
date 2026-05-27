<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let canvas: HTMLCanvasElement;
	let rafId: number;
	let renderer: THREE.WebGLRenderer;

	type ParticleSpec = {
		count:     number;   // number of particles in this group
		hue:       number;   // base hue 0–1
		hueSpread: number;   // hue variance 0–1
		speedMin:  number;   // minimum initial speed (world units/s)
		speedMax:  number;   // maximum initial speed
		size:      number;   // dot size in pixels
	};

	const particleSpecs: ParticleSpec[] = [
		{ count: 1500, hue: 0.0, hueSpread: 0.3, speedMin: 1, speedMax: 4, size: 2 },
		{ count: 100,  hue: 0.5, hueSpread: 0.3, speedMin: 1, speedMax: 4, size: 4 },
		{ count: 30,   hue: 0.5, hueSpread: 0.3, speedMin: 1, speedMax: 4, size: 8 },
		{ count: 10,   hue: 0.5, hueSpread: 0.3, speedMin: 1, speedMax: 4, size: 16 },
	];

	const G               = 0.002; // calibrated for mass = force² (default force² = 2500)
	const DILUTION        = 1;     // > 1 strengthens gravity, < 1 weakens it
	const BRAKE           = 0.4;   // world-units/s deceleration, independent of speed
	const MAX_CENTERS     = 10;
	const DEFAULT_FORCE   = 50;    // px — single / far touches
	const MERGE_THRESHOLD = 150;   // px — touches closer than this merge

	onMount(() => {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		const viewH = 12;
		let viewW = viewH * (w / h);

		const camera = new THREE.OrthographicCamera(-viewW, viewW, viewH, -viewH, 0.1, 100);
		camera.position.z = 10;                                                                         

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x000000);

		renderer = new THREE.WebGLRenderer({ canvas });
		renderer.setPixelRatio(devicePixelRatio);
		renderer.setSize(w, h);

		// Raw pointer positions — CSS pixels (for distance) + world coords (for physics)
		const activeCenters = new Map<number, {
			clientX: number; clientY: number;
			x: number; y: number;
		}>();

		// Greedy pair-merging: closest pair below MERGE_THRESHOLD merges first
		const computeEffectiveCenters = () => {
			const raw  = [...activeCenters.values()];
			const used = new Set<number>();
			const out: Array<{ x: number; y: number; force: number }> = [];

			for (;;) {
				let minDist = MERGE_THRESHOLD, minI = -1, minJ = -1;
				for (let i = 0; i < raw.length; i++) {
					if (used.has(i)) continue;
					for (let j = i + 1; j < raw.length; j++) {
						if (used.has(j)) continue;
						const dx = raw[i].clientX - raw[j].clientX;
						const dy = raw[i].clientY - raw[j].clientY;
						const d  = Math.sqrt(dx * dx + dy * dy);
						if (d < minDist) { minDist = d; minI = i; minJ = j; }
					}
				}
				if (minI === -1) break;
				out.push({
					x:     (raw[minI].x + raw[minJ].x) / 2,
					y:     (raw[minI].y + raw[minJ].y) / 2,
					force: minDist,
				});
				used.add(minI); used.add(minJ);
			}

			for (let i = 0; i < raw.length; i++) {
				if (!used.has(i)) out.push({ x: raw[i].x, y: raw[i].y, force: DEFAULT_FORCE });
			}
			return out;
		};

		// Build per-group state from specs
		const tmpColor = new THREE.Color();
		const groups = particleSpecs.map(spec => {
			const positions = new Float32Array(spec.count * 3);
			const colors    = new Float32Array(spec.count * 3);
			const vx        = new Float32Array(spec.count);
			const vy        = new Float32Array(spec.count);

			for (let i = 0; i < spec.count; i++) {
				positions[i * 3]     = (Math.random() * 2 - 1) * viewW;
				positions[i * 3 + 1] = (Math.random() * 2 - 1) * viewH;
				positions[i * 3 + 2] = 0;

				const speed = spec.speedMin + Math.random() * (spec.speedMax - spec.speedMin);
				const angle = Math.random() * Math.PI * 2;
				vx[i] = Math.cos(angle) * speed;
				vy[i] = Math.sin(angle) * speed;

				const hue = spec.hue + (Math.random() - 0.5) * spec.hueSpread;
				tmpColor.setHSL(((hue % 1) + 1) % 1, 1.0, 0.6);
				colors[i * 3]     = tmpColor.r;
				colors[i * 3 + 1] = tmpColor.g;
				colors[i * 3 + 2] = tmpColor.b;
			}

			const geo = new THREE.BufferGeometry();
			geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
			geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
			scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
				size: spec.size, sizeAttenuation: false, vertexColors: true,
			})));

			return { spec, positions, vx, vy, geo };
		});

		// world units per pixel — used to convert px sizes to world-space scale
		let wpp = (viewH * 2) / h;

		// White square pool for center markers (one Mesh per slot)
		const squareGeo = new THREE.CircleGeometry(0.5, 48);
		const squareMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
		const centerMeshes: THREE.Mesh[] = [];
		for (let i = 0; i < MAX_CENTERS; i++) {
			const mesh = new THREE.Mesh(squareGeo, squareMat);
			mesh.visible = false;
			scene.add(mesh);
			centerMeshes.push(mesh);
		}

		// Coordinate conversion
		const toWorld = (clientX: number, clientY: number) => {
			const rect = canvas.getBoundingClientRect();
			return {
				x:  ((clientX - rect.left) / rect.width  * 2 - 1) * viewW,
				y: -((clientY - rect.top)  / rect.height * 2 - 1) * viewH,
			};
		};

		const onPointerDown = (e: PointerEvent) => {
			const { x, y } = toWorld(e.clientX, e.clientY);
			activeCenters.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, x, y });
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!activeCenters.has(e.pointerId)) return;
			const { x, y } = toWorld(e.clientX, e.clientY);
			activeCenters.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, x, y });
		};

		const onPointerUp = (e: PointerEvent) => activeCenters.delete(e.pointerId);

		canvas.addEventListener('pointerdown',   onPointerDown);
		canvas.addEventListener('pointermove',   onPointerMove);
		canvas.addEventListener('pointerup',     onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);

		const onResize = () => {
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			viewW = viewH * (w / h);
			wpp   = (viewH * 2) / h;
			camera.left   = -viewW;
			camera.right  =  viewW;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		};
		window.addEventListener('resize', onResize);

		let lastTime = performance.now();

		const animate = () => {
			rafId = requestAnimationFrame(animate);
			const now = performance.now();
			const dt  = Math.min((now - lastTime) / 1000, 0.05);
			lastTime  = now;

			// Compute effective centers (merging close pairs)
			const effective = computeEffectiveCenters();

			// Sync center markers
			for (let i = 0; i < MAX_CENTERS; i++) {
				const c    = effective[i];
				const mesh = centerMeshes[i];
				if (c) {
					mesh.position.set(c.x, c.y, 0);
					mesh.scale.setScalar(c.force * wpp);
					mesh.visible = true;
				} else {
					mesh.visible = false;
				}
			}

			for (const g of groups) {
				for (let i = 0; i < g.spec.count; i++) {
					let px = g.positions[i * 3];
					let py = g.positions[i * 3 + 1];
					let ax = 0, ay = 0;

					for (const c of effective) {
						const dx = c.x - px;
						const dy = c.y - py;
						const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.4);
						const force = G * (c.force ** 2) / ((dist / DILUTION) ** 2);
						ax += (force * dx) / dist;
						ay += (force * dy) / dist;
					}

					g.vx[i] += ax * dt;
					g.vy[i] += ay * dt;

					const spd = Math.sqrt(g.vx[i] ** 2 + g.vy[i] ** 2);
					if (spd > 0) {
						const braked = Math.max(0, spd - BRAKE * dt);
						g.vx[i] *= braked / spd;
						g.vy[i] *= braked / spd;
					}

					px += g.vx[i] * dt;
					py += g.vy[i] * dt;

					if (px >  viewW) { px =  viewW; g.vx[i] = -Math.abs(g.vx[i]); }
					if (px < -viewW) { px = -viewW; g.vx[i] =  Math.abs(g.vx[i]); }
					if (py >  viewH) { py =  viewH; g.vy[i] = -Math.abs(g.vy[i]); }
					if (py < -viewH) { py = -viewH; g.vy[i] =  Math.abs(g.vy[i]); }

					g.positions[i * 3]     = px;
					g.positions[i * 3 + 1] = py;
				}
				g.geo.attributes.position.needsUpdate = true;
			}

			renderer.render(scene, camera);
		};
		animate();

		return () => {
			window.removeEventListener('resize', onResize);
			canvas.removeEventListener('pointerdown',   onPointerDown);
			canvas.removeEventListener('pointermove',   onPointerMove);
			canvas.removeEventListener('pointerup',     onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
		};
	});

	onDestroy(() => {
		cancelAnimationFrame(rafId);
		renderer?.dispose();
	});
</script>

<svelte:head><title>Gravity</title></svelte:head>

<canvas bind:this={canvas} style="width:100vw;height:100vh;display:block;touch-action:none;"></canvas>
