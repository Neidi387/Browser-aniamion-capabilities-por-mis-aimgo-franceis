<svelte:head>
	<title>CV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let debugCanvas: HTMLCanvasElement;
	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let handLandmarker: HandLandmarker | null = null;
	let videoCtx!: CanvasRenderingContext2D;
	let debugCtx!: CanvasRenderingContext2D;
	let overlayCtx!: CanvasRenderingContext2D;

	let lastDetectTime = 0;
	const DETECT_INTERVAL_MS = 66; // ~15 fps

	const GRAB_ZONE_FACTOR = 1.5;
	const GRAB_TOLERANCE_FACTOR = 0.5;
	const FINGERTIP_INDICES = [4, 8, 12, 16, 20];
	let handGrabbing: (number | null)[] = [null, null];

	const W = 640;
	const H = 480;

	let circles = [
		{ x: 160, y: 240, r: 50 },
		{ x: 480, y: 240, r: 50 }
	];
	let dragging: number | null = null;
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	function drawCircles() {
		overlayCtx.clearRect(0, 0, W, H);
		for (const c of circles) {
			overlayCtx.beginPath();
			overlayCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
			overlayCtx.strokeStyle = 'red';
			overlayCtx.lineWidth = 3;
			overlayCtx.stroke();
		}
	}

	function drawLandmarks(results: ReturnType<HandLandmarker['detectForVideo']>) {
		debugCtx.clearRect(0, 0, W, H);
		for (const landmarks of results.landmarks) {
			debugCtx.beginPath();
			debugCtx.strokeStyle = 'lime';
			debugCtx.lineWidth = 2;
			for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
				const p1 = landmarks[start];
				const p2 = landmarks[end];
				debugCtx.moveTo((1 - p1.x) * W, p1.y * H);
				debugCtx.lineTo((1 - p2.x) * W, p2.y * H);
			}
			debugCtx.stroke();
			debugCtx.fillStyle = 'cyan';
			for (const lm of landmarks) {
				debugCtx.beginPath();
				debugCtx.arc((1 - lm.x) * W, lm.y * H, 4, 0, Math.PI * 2);
				debugCtx.fill();
			}
		}
	}

	function updateHandGrab(results: ReturnType<HandLandmarker['detectForVideo']>) {
		handGrabbing = [null, null];
		const grabbed = new Set<number>();

		for (let i = 0; i < results.landmarks.length; i++) {
			const landmarks = results.landmarks[i];

			for (let j = 0; j < circles.length; j++) {
				if (grabbed.has(j)) continue;
				const c = circles[j];
				const grabRadius = c.r * GRAB_ZONE_FACTOR;
				const allInZone = FINGERTIP_INDICES.every((idx) => {
					const lm = landmarks[idx];
					return Math.hypot((1 - lm.x) * W - c.x, lm.y * H - c.y) < grabRadius + c.r * GRAB_TOLERANCE_FACTOR;
				});
				if (allInZone) {
					handGrabbing[i] = j;
					grabbed.add(j);
					break;
				}
			}

			if (handGrabbing[i] !== null) {
				const cx = (1 - landmarks.reduce((s, lm) => s + lm.x, 0) / landmarks.length) * W;
				const cy = (landmarks.reduce((s, lm) => s + lm.y, 0) / landmarks.length) * H;
				circles[handGrabbing[i]!].x = cx;
				circles[handGrabbing[i]!].y = cy;
			}
		}

		drawCircles();
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (handLandmarker && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				const results = handLandmarker.detectForVideo(videoEl, now);
				drawLandmarks(results);
				updateHandGrab(results);
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	function getCanvasPos(e: MouseEvent) {
		const rect = overlayCanvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (W / rect.width),
			y: (e.clientY - rect.top) * (H / rect.height)
		};
	}

	function onMouseDown(e: MouseEvent) {
		const { x, y } = getCanvasPos(e);
		for (let i = 0; i < circles.length; i++) {
			const c = circles[i];
			const dist = Math.hypot(x - c.x, y - c.y);
			if (dist < c.r) {
				dragging = i;
				dragOffsetX = x - c.x;
				dragOffsetY = y - c.y;
				break;
			}
		}
	}

	function onMouseMove(e: MouseEvent) {
		if (dragging === null) return;
		const { x, y } = getCanvasPos(e);
		circles[dragging].x = x - dragOffsetX;
		circles[dragging].y = y - dragOffsetY;
		drawCircles();
	}

	function onMouseUp() {
		dragging = null;
	}

	onMount(async () => {
		videoCtx = videoCanvas.getContext('2d')!;
		debugCtx = debugCanvas.getContext('2d')!;
		overlayCtx = overlayCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		drawCircles();
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
			);
			handLandmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
					delegate: 'GPU'
				},
				runningMode: 'VIDEO',
				numHands: 2
			});
		} catch (err) {
			console.error('MediaPipe failed to load:', err);
		}
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		stream?.getTracks().forEach((t) => t.stop());
	});
</script>

<div class="page">
	<video bind:this={videoEl} autoplay playsinline muted style="display:none"></video>
	<div class="wrapper">
		<canvas bind:this={videoCanvas} width={W} height={H}></canvas>
		<canvas
			bind:this={overlayCanvas}
			width={W}
			height={H}
			class="overlay"
			onmousedown={onMouseDown}
			onmousemove={onMouseMove}
			onmouseup={onMouseUp}
			onmouseleave={onMouseUp}
		></canvas>
		<canvas bind:this={debugCanvas} width={W} height={H} class="overlay debug"></canvas>
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #111;
	}

	.wrapper {
		position: relative;
	}

	canvas {
		display: block;
	}

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		cursor: crosshair;
	}

	.debug {
		pointer-events: none;
	}
</style>
