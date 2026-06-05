<svelte:head>
	<title>Face Crop — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		FaceDetector,
		FaceLandmarker,
		FilesetResolver,
		type Classifications
	} from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const DETECTOR_MODEL =
		'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
	const LANDMARK_MODEL =
		'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

	const W = 640;
	const H = 480;
	const CROP_W = 360;
	const CROP_H = 460;
	const DETECT_MS = 66;
	// padding as a fraction of the larger bounding-box dimension, applied on each side
	const PAD = 0.38;
	// lerp factor per RAF frame (~60 fps → time constant ≈ 160 ms)
	const LERP = 0.1;

	let videoEl: HTMLVideoElement;
	let hiddenCanvas: HTMLCanvasElement;
	let cropCanvas: HTMLCanvasElement;
	let overlayCanvas: HTMLCanvasElement;
	let hiddenCtx!: CanvasRenderingContext2D;
	let cropCtx!: CanvasRenderingContext2D;
	let overlayCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let detector: FaceDetector | null = null;
	let landmarker: FaceLandmarker | null = null;
	let lastDetectTime = 0;

	// smoothBox lerps toward targetBox every RAF frame
	let smoothBox = { x: W * 0.15, y: H * 0.05, w: W * 0.7, h: H * 0.9 };
	let targetBox = { ...smoothBox };

	let blendshapes: Classifications[] = $state([]);

	function updateTarget(bb: {
		originX: number;
		originY: number;
		width: number;
		height: number;
	}) {
		const pad = Math.max(bb.width, bb.height) * PAD;
		const x = Math.max(0, bb.originX - pad);
		const y = Math.max(0, bb.originY - pad);
		const w = Math.min(W - x, bb.width + pad * 2);
		const h = Math.min(H - y, bb.height + pad * 2);
		targetBox = { x, y, w, h };
	}

	function lerpBox() {
		smoothBox.x += (targetBox.x - smoothBox.x) * LERP;
		smoothBox.y += (targetBox.y - smoothBox.y) * LERP;
		smoothBox.w += (targetBox.w - smoothBox.w) * LERP;
		smoothBox.h += (targetBox.h - smoothBox.h) * LERP;
	}

	function drawLandmarks(results: ReturnType<FaceLandmarker['detectForVideo']>) {
		overlayCtx.clearRect(0, 0, CROP_W, CROP_H);
		blendshapes = results.faceBlendshapes ?? [];

		for (const landmarks of results.faceLandmarks) {
			// Mesh tesselation — landmark coords are normalized to cropCanvas (no x-flip
			// needed because the crop already comes from the mirrored hiddenCanvas)
			overlayCtx.strokeStyle = 'rgba(0, 220, 180, 0.35)';
			overlayCtx.lineWidth = 1;
			overlayCtx.beginPath();
			for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
				const p1 = landmarks[start];
				const p2 = landmarks[end];
				overlayCtx.moveTo(p1.x * CROP_W, p1.y * CROP_H);
				overlayCtx.lineTo(p2.x * CROP_W, p2.y * CROP_H);
			}
			overlayCtx.stroke();

			// Eye and lip contours
			overlayCtx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
			overlayCtx.lineWidth = 1.5;
			overlayCtx.beginPath();
			for (const conn of [
				...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
				...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
				...FaceLandmarker.FACE_LANDMARKS_LIPS
			]) {
				const p1 = landmarks[conn.start];
				const p2 = landmarks[conn.end];
				overlayCtx.moveTo(p1.x * CROP_W, p1.y * CROP_H);
				overlayCtx.lineTo(p2.x * CROP_W, p2.y * CROP_H);
			}
			overlayCtx.stroke();
		}
	}

	function loop() {
		// Mirror full video frame into the hidden canvas every RAF
		hiddenCtx.save();
		hiddenCtx.translate(W, 0);
		hiddenCtx.scale(-1, 1);
		hiddenCtx.drawImage(videoEl, 0, 0, W, H);
		hiddenCtx.restore();

		lerpBox();

		if (videoEl.readyState >= 2) {
			// Render the smoothed crop every frame for fluid video
			cropCtx.drawImage(
				hiddenCanvas,
				smoothBox.x,
				smoothBox.y,
				smoothBox.w,
				smoothBox.h,
				0,
				0,
				CROP_W,
				CROP_H
			);

			const now = performance.now();
			if (now - lastDetectTime >= DETECT_MS) {
				lastDetectTime = now;

				// Step 1: face bounding box on the full mirrored frame
				if (detector) {
					const det = detector.detectForVideo(hiddenCanvas, now);
					if (det.detections.length > 0 && det.detections[0].boundingBox) {
						updateTarget(det.detections[0].boundingBox);
					}
				}

				// Step 2: 478-point landmarks on the already-drawn crop
				if (landmarker) {
					const results = landmarker.detectForVideo(cropCanvas, now);
					drawLandmarks(results);
				}
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	onMount(async () => {
		hiddenCtx = hiddenCanvas.getContext('2d')!;
		cropCtx = cropCanvas.getContext('2d')!;
		overlayCtx = overlayCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(WASM);
			// Load sequentially — avoids parallel GPU initialisation issues
			detector = await FaceDetector.createFromOptions(vision, {
				baseOptions: { modelAssetPath: DETECTOR_MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO'
			});
			landmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: LANDMARK_MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numFaces: 1,
				outputFaceBlendshapes: true,
				outputFacialTransformationMatrixes: false
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

<video bind:this={videoEl} autoplay playsinline muted style="display:none"></video>
<canvas bind:this={hiddenCanvas} width={W} height={H} style="display:none"></canvas>

<div class="page">
	<div class="top">
		{#if blendshapes.length > 0}
			{#each blendshapes as face}
				{#each face.categories as cat}
					<div class="row">
						<span class="label">{cat.categoryName}</span>
						<div class="bar-track">
							<div class="bar-fill" style="width:{(cat.score * 100).toFixed(1)}%"></div>
						</div>
						<span class="val">{cat.score.toFixed(2)}</span>
					</div>
				{/each}
			{/each}
		{:else}
			<div class="loading">Loading models…</div>
		{/if}
	</div>

	<div class="bottom">
		<div class="wrapper">
			<canvas bind:this={cropCanvas} width={CROP_W} height={CROP_H}></canvas>
			<canvas bind:this={overlayCanvas} width={CROP_W} height={CROP_H} class="overlay"></canvas>
		</div>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		padding-top: 90px;
		box-sizing: border-box;
		background: #111;
		overflow: hidden;
	}

	.top {
		flex: 1;
		overflow-y: auto;
		padding: 10px 16px 6px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
	}

	.bottom {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		padding-bottom: 14px;
		flex-shrink: 0;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
		box-sizing: border-box;
	}

	.wrapper {
		position: relative;
		width: min(360px, 100%);
		aspect-ratio: 360 / 460;
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

	.loading {
		font-family: monospace;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.28);
		padding: 24px 0;
		text-align: center;
		letter-spacing: 0.06em;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 3px;
	}

	.label {
		font-family: monospace;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.5);
		width: 160px;
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-track {
		flex: 1;
		height: 4px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: rgba(0, 220, 180, 0.7);
		border-radius: 2px;
		transition: width 66ms linear;
	}

	.val {
		font-family: monospace;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.35);
		width: 30px;
		text-align: right;
		flex-shrink: 0;
	}
</style>
