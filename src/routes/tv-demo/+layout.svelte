<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const demos = [
		{ href: '/tv-demo/drawing', label: 'Drawing' },
		{ href: '/tv-demo/gesture', label: 'Gesture' },
		{ href: '/tv-demo/face-detector', label: 'Face Detect' },
		{ href: '/tv-demo/face-landmarks', label: 'Face Mesh' },
		{ href: '/tv-demo/face-landmarks-crop', label: 'Face Crop' },
		{ href: '/tv-demo/pose', label: 'Pose' },
		{ href: '/tv-demo/object-detector', label: 'Objects' },
		{ href: '/tv-demo/image-segmenter', label: 'Segmenter' },
		{ href: '/tv-demo/holistic', label: 'Holistic' }
	];
</script>

<div class="subnav">
	<a href="/tv-demo" class="subnav-title" class:active={$page.url.pathname === '/tv-demo'}>
		TV Demo
	</a>
	<div class="subnav-links">
		{#each demos as d}
			<a href={d.href} class:active={$page.url.pathname === d.href}>{d.label}</a>
		{/each}
	</div>
</div>

{@render children()}

<style>
	.subnav {
		position: fixed;
		top: 49px;
		left: 0;
		right: 0;
		z-index: 99;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem 1.5rem;
		background: rgba(10, 10, 20, 0.85);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		font-family: 'Courier New', monospace;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.subnav::-webkit-scrollbar {
		display: none;
	}

	.subnav-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
		text-decoration: none;
		white-space: nowrap;
		transition: color 0.2s;
	}

	.subnav-title.active {
		color: #fff;
	}

	.subnav-links {
		display: flex;
		gap: 1.25rem;
		flex-shrink: 0;
	}

	.subnav-links a {
		font-size: 0.72rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
		text-decoration: none;
		white-space: nowrap;
		transition: color 0.2s;
		padding: 0.2rem 0;
		border-bottom: 1px solid transparent;
	}

	.subnav-links a:hover {
		color: rgba(255, 255, 255, 0.8);
	}

	.subnav-links a.active {
		color: #fff;
		border-bottom-color: rgba(255, 255, 255, 0.5);
	}
</style>
