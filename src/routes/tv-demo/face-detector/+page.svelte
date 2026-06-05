<svelte:head>
	<title>Face Detector — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
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
	let detector: FaceDetector | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	const KP_COLORS = ['#ff4d6d', '#4db8ff', '#ffd24d', '#4dffb0', '#c84dff', '#ff9a4d'];

	function drawResults(results: ReturnType<FaceDetector['detectForVideo']>) {
		overlayCtx.clearRect(0, 0, W, H);

		const scaleX = W / (videoEl.videoWidth || W);
		const scaleY = H / (videoEl.videoHeight || H);

		for (const det of results.detections) {
			const bb = det.boundingBox;
			if (!bb) continue;

			const w = bb.width * scaleX;
			const h = bb.height * scaleY;
			const x = W - (bb.originX + bb.width) * scaleX;
			const y = bb.originY * scaleY;

			overlayCtx.strokeStyle = '#4dffb0';
			overlayCtx.lineWidth = 2;
			overlayCtx.strokeRect(x, y, w, h);

			const score = det.categories[0]?.score ?? 0;
			overlayCtx.font = '12px Courier New';
			overlayCtx.fillStyle = '#4dffb0';
			overlayCtx.fillText(`${Math.round(score * 100)}%`, x + 4, y - 6);

			if (det.keypoints) {
				for (let ki = 0; ki < det.keypoints.length; ki++) {
					const kp = det.keypoints[ki];
					const kx = (1 - kp.x) * W;
					const ky = kp.y * H;
					overlayCtx.beginPath();
					overlayCtx.arc(kx, ky, 4, 0, Math.PI * 2);
					overlayCtx.fillStyle = KP_COLORS[ki % KP_COLORS.length];
					overlayCtx.fill();
				}
			}
		}
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (detector && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				const results = detector.detectForVideo(videoEl, now);
				drawResults(results);
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
			detector = await FaceDetector.createFromOptions(vision, {
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
</style>
