import * as THREE from 'three';
import type { HumanFigure } from './types.js';

const U = 0.15;

function makePart(
	geo: THREE.BufferGeometry,
	mat: THREE.Material,
	name: string,
	x: number,
	y: number,
	z: number
): THREE.Mesh {
	const mesh = new THREE.Mesh(geo, mat);
	mesh.name = name;
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	return mesh;
}

export function buildHumanFigure(): HumanFigure {
	const mat = new THREE.MeshPhongMaterial({ color: 0xd4a574 });
	const root = new THREE.Group();
	root.name = 'humanRoot';

	const meshes: Record<string, THREE.Mesh> = {};

	const parts: [THREE.BufferGeometry, string, number, number, number, number?][] = [
		[new THREE.SphereGeometry(U * 1.1, 16, 12), 'head', 0, U * 4, 0],
		[new THREE.CylinderGeometry(U * 0.35, U * 0.38, U * 0.6, 10), 'neck', 0, U * 3.2, 0],
		[new THREE.CylinderGeometry(U * 0.7, U * 0.85, U * 2.5, 10), 'torso', 0, U * 1.5, 0],
		[new THREE.CylinderGeometry(U * 0.8, U * 0.75, U * 0.6, 10), 'pelvis', 0, U * 0.05, 0],
		// Arms
		[new THREE.CylinderGeometry(U * 0.28, U * 0.25, U * 1.4, 10), 'upperArmL', -U * 1.2, U * 2.0, 0],
		[new THREE.CylinderGeometry(U * 0.28, U * 0.25, U * 1.4, 10), 'upperArmR', U * 1.2, U * 2.0, 0],
		[new THREE.CylinderGeometry(U * 0.22, U * 0.2, U * 1.3, 10), 'lowerArmL', -U * 1.25, U * 0.85, 0],
		[new THREE.CylinderGeometry(U * 0.22, U * 0.2, U * 1.3, 10), 'lowerArmR', U * 1.25, U * 0.85, 0],
		// Legs
		[new THREE.CylinderGeometry(U * 0.35, U * 0.3, U * 1.6, 10), 'upperLegL', -U * 0.42, -U * 1.2, 0],
		[new THREE.CylinderGeometry(U * 0.35, U * 0.3, U * 1.6, 10), 'upperLegR', U * 0.42, -U * 1.2, 0],
		[new THREE.CylinderGeometry(U * 0.28, U * 0.25, U * 1.5, 10), 'lowerLegL', -U * 0.42, -U * 2.8, 0],
		[new THREE.CylinderGeometry(U * 0.28, U * 0.25, U * 1.5, 10), 'lowerLegR', U * 0.42, -U * 2.8, 0]
	];

	for (const [geo, name, x, y, z] of parts) {
		const mesh = makePart(geo, mat, name, x, y, z);
		meshes[name] = mesh;
		root.add(mesh);
	}

	return { root, meshes };
}
