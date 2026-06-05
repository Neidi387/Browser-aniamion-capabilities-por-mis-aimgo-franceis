<svelte:head>
	<title>Holistic — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { HolisticLandmarker, FilesetResolver, type HolisticLandmarkerResult } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task';
	const W = 640;
	const H = 480;
	const DETECT_INTERVAL_MS = 66;

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let videoCtx!: CanvasRenderingContext2D;
	let overlayCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let landmarker: HolisticLandmarker | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	function drawConnections(
		landmarks: { x: number; y: number; z: number; visibility?: number }[],
		connections: { start: number; end: number }[],
		color: string,
		lineWidth = 2
	) {
		overlayCtx.strokeStyle = color;
		overlayCtx.lineWidth = lineWidth;
		overlayCtx.beginPath();
		for (const { start, end } of connections) {
			const p1 = landmarks[start];
			const p2 = landmarks[end];
			if (!p1 || !p2) continue;
			if ((p1.visibility ?? 1) < 0.3 || (p2.visibility ?? 1) < 0.3) continue;
			overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
			overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
		}
		overlayCtx.stroke();
	}

	function drawDots(
		landmarks: { x: number; y: number; z: number; visibility?: number }[],
		color: string,
		radius = 3
	) {
		overlayCtx.fillStyle = color;
		for (const lm of landmarks) {
			if ((lm.visibility ?? 1) < 0.3) continue;
			overlayCtx.beginPath();
			overlayCtx.arc((1 - lm.x) * W, lm.y * H, radius, 0, Math.PI * 2);
			overlayCtx.fill();
		}
	}

	function drawResults(result: HolisticLandmarkerResult) {
		overlayCtx.clearRect(0, 0, W, H);

		if (result.poseLandmarks?.length) {
			drawConnections(result.poseLandmarks[0], HolisticLandmarker.POSE_CONNECTIONS, 'rgba(255, 210, 77, 0.8)', 3);
			drawDots(result.poseLandmarks[0], '#ffd24d', 5);
		}

		if (result.faceLandmarks?.length) {
			overlayCtx.strokeStyle = 'rgba(0, 200, 180, 0.3)';
			overlayCtx.lineWidth = 1;
			overlayCtx.beginPath();
			for (const { start, end } of HolisticLandmarker.FACE_LANDMARKS_TESSELATION) {
				const p1 = result.faceLandmarks[0][start];
				const p2 = result.faceLandmarks[0][end];
				if (!p1 || !p2) continue;
				overlayCtx.moveTo((1 - p1.x) * W, p1.y * H);
				overlayCtx.lineTo((1 - p2.x) * W, p2.y * H);
			}
			overlayCtx.stroke();
		}

		if (result.leftHandLandmarks?.length) {
			drawConnections(result.leftHandLandmarks[0], HolisticLandmarker.HAND_CONNECTIONS, 'rgba(100, 255, 150, 0.9)', 2);
			drawDots(result.leftHandLandmarks[0], '#64ff96', 4);
		}

		if (result.rightHandLandmarks?.length) {
			drawConnections(result.rightHandLandmarks[0], HolisticLandmarker.HAND_CONNECTIONS, 'rgba(100, 180, 255, 0.9)', 2);
			drawDots(result.rightHandLandmarks[0], '#64b4ff', 4);
		}
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (landmarker && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				landmarker.detectForVideo(videoEl, now, drawResults);
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	onMount(async () => {
		videoCtx = videoCanvas.getContext('2d')!;
		overlayCtx = overlayCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		videoW = videoEl.videoWidth || 640;
		videoH = videoEl.videoHeight || 480;
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(WASM);
			landmarker = await HolisticLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO'
			});
		} catch (err) {
			console.error('MediaPipe failed:', err);
		}
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		stream?.getTracks().forEach((t) => t.stop());
	});
</script>

<div class="page">
	<video bind:this={videoEl} autoplay playsinline muted style="display:none"></video>
	<div class="wrapper" style="aspect-ratio: {videoW} / {videoH}">
		<canvas bind:this={videoCanvas} width={W} height={H}></canvas>
		<canvas bind:this={overlayCanvas} width={W} height={H} class="overlay"></canvas>
		<div class="legend">
			<span class="face">Face</span>
			<span class="pose">Pose</span>
			<span class="lhand">L. Hand</span>
			<span class="rhand">R. Hand</span>
		</div>
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-height: 100vh;
		background: #111;
		padding: 90px 0.5rem 1.5rem;
		box-sizing: border-box;
	}

	.wrapper {
		position: relative;
		width: min(640px, 100%);
	}

	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	.overlay {
		pointer-events: none;
	}

	.legend {
		position: absolute;
		bottom: 12px;
		right: 14px;
		display: flex;
		gap: 1rem;
		font-family: 'Courier New', monospace;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		pointer-events: none;
	}

	.face { color: #00c8b4; }
	.pose { color: #ffd24d; }
	.lhand { color: #64ff96; }
	.rhand { color: #64b4ff; }
</style>
