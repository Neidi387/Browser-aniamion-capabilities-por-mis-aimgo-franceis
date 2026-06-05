<svelte:head>
	<title>Segmenter — TV Demo</title>
</svelte:head>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

	const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
	const MODEL =
		'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
	const W = 640;
	const H = 480;
	const DETECT_INTERVAL_MS = 66;

	let videoEl: HTMLVideoElement;
	let videoCanvas: HTMLCanvasElement;
	let maskCanvas: HTMLCanvasElement;
	let videoCtx!: CanvasRenderingContext2D;
	let maskCtx!: CanvasRenderingContext2D;

	let stream: MediaStream | null = null;
	let rafId: number | null = null;
	let segmenter: ImageSegmenter | null = null;
	let lastDetectTime = 0;

	let videoW = $state(640);
	let videoH = $state(480);

	let mode = $state<'silhouette' | 'background'>('silhouette');

	function applyMask(mask: Uint8Array) {
		const videoFrame = videoCtx.getImageData(0, 0, W, H);
		const out = maskCtx.createImageData(W, H);

		for (let y = 0; y < H; y++) {
			for (let x = 0; x < W; x++) {
				const i = y * W + x;
				const maskIdx = y * W + (W - 1 - x);
				const isPerson = mask[maskIdx] > 0;
				const srcIdx = i * 4;

				if (mode === 'silhouette') {
					if (isPerson) {
						out.data[srcIdx] = videoFrame.data[srcIdx];
						out.data[srcIdx + 1] = videoFrame.data[srcIdx + 1];
						out.data[srcIdx + 2] = videoFrame.data[srcIdx + 2];
						out.data[srcIdx + 3] = 255;
					} else {
						out.data[srcIdx] = 20;
						out.data[srcIdx + 1] = 20;
						out.data[srcIdx + 2] = 40;
						out.data[srcIdx + 3] = 220;
					}
				} else {
					if (!isPerson) {
						out.data[srcIdx] = videoFrame.data[srcIdx];
						out.data[srcIdx + 1] = videoFrame.data[srcIdx + 1];
						out.data[srcIdx + 2] = videoFrame.data[srcIdx + 2];
						out.data[srcIdx + 3] = 255;
					} else {
						out.data[srcIdx] = 0;
						out.data[srcIdx + 1] = 200;
						out.data[srcIdx + 2] = 150;
						out.data[srcIdx + 3] = 120;
					}
				}
			}
		}

		maskCtx.putImageData(out, 0, 0);
	}

	function loop() {
		videoCtx.save();
		videoCtx.translate(W, 0);
		videoCtx.scale(-1, 1);
		videoCtx.drawImage(videoEl, 0, 0, W, H);
		videoCtx.restore();

		if (segmenter && videoEl.readyState >= 2) {
			const now = performance.now();
			if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
				lastDetectTime = now;
				segmenter.segmentForVideo(videoEl, now, (result) => {
					const mask = result.categoryMask?.getAsUint8Array();
					if (mask) applyMask(mask);
					result.close();
				});
			}
		}

		rafId = requestAnimationFrame(loop);
	}

	onMount(async () => {
		videoCtx = videoCanvas.getContext('2d')!;
		maskCtx = maskCanvas.getContext('2d')!;

		stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await videoEl.play();
		videoW = videoEl.videoWidth || 640;
		videoH = videoEl.videoHeight || 480;
		rafId = requestAnimationFrame(loop);

		try {
			const vision = await FilesetResolver.forVisionTasks(WASM);
			segmenter = await ImageSegmenter.createFromOptions(vision, {
				baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
				runningMode: 'VIDEO',
				outputCategoryMask: true,
				outputConfidenceMasks: false
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
		<canvas bind:this={videoCanvas} width={W} height={H} class="hidden"></canvas>
		<canvas bind:this={maskCanvas} width={W} height={H}></canvas>
		<div class="ui">
			<button class:active={mode === 'silhouette'} onclick={() => (mode = 'silhouette')}>
				Silhouette
			</button>
			<button class:active={mode === 'background'} onclick={() => (mode = 'background')}>
				Background
			</button>
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

	.hidden {
		display: none !important;
	}

	.ui {
		position: absolute;
		bottom: 12px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 0.75rem;
	}

	button {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.5);
		font-family: 'Courier New', monospace;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.9rem;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	button.active {
		background: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.4);
		color: #fff;
	}

	button:hover {
		color: #fff;
	}
</style>
