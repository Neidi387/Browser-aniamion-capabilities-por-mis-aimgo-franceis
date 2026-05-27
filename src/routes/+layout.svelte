<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<a href="/" class:active={$page.url.pathname === '/'}>WebGL Demos</a>
	<div class="links">
		<a href="/jumping-man" class:active={$page.url.pathname === '/jumping-man'}>Jumping Man</a>
		<a href="/blender-circle" class:active={$page.url.pathname === '/blender-circle'}>Blender Circle</a>
		<a href="/cv-demo" class:active={$page.url.pathname === '/cv-demo'}>CV Demo</a>
		<a href="/gravity" class:active={$page.url.pathname === '/gravity'}>Gravity</a>
	</div>
</nav>

{@render children()}

<style>
	nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.5rem;
		background: rgba(10, 10, 20, 0.7);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		font-family: 'Courier New', monospace;
	}

	nav a {
		color: rgba(255, 255, 255, 0.55);
		text-decoration: none;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transition: color 0.2s;
	}

	nav a:first-child {
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}

	nav a:hover {
		color: #fff;
	}

	nav a.active {
		color: #fff;
		border-bottom: 1px solid rgba(255, 255, 255, 0.6);
	}

	.links {
		display: flex;
		gap: 1.5rem;
	}
</style>
