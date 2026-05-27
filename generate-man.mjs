import * as THREE from 'three';
import { writeFileSync } from 'fs';

// Collect all mesh parts with their world-space transforms
const parts = [
	{ geo: new THREE.BoxGeometry(0.6, 0.9, 0.3),    pos: [0, 1.45, 0] },
	{ geo: new THREE.SphereGeometry(0.25, 16, 12),  pos: [0, 2.15, 0] },
	{ geo: new THREE.BoxGeometry(0.2, 0.7, 0.2),    pos: [-0.45, 1.45, 0] },
	{ geo: new THREE.BoxGeometry(0.2, 0.7, 0.2),    pos: [0.45, 1.45, 0] },
	{ geo: new THREE.BoxGeometry(0.22, 0.8, 0.22),  pos: [-0.19, 0.4, 0] },
	{ geo: new THREE.BoxGeometry(0.22, 0.8, 0.22),  pos: [0.19, 0.4, 0] },
];

// Build combined buffer, accessors, and meshes for GLTF
const bufferChunks = [];
const accessors = [];
const meshPrimitives = [];

let byteOffset = 0;

for (const { geo, pos } of parts) {
	geo.computeVertexNormals();

	const posAttr = geo.attributes.position;
	const normAttr = geo.attributes.normal;
	const idxAttr = geo.index;

	// Apply position offset into the position buffer
	const posArr = new Float32Array(posAttr.array);
	for (let i = 0; i < posArr.length; i += 3) {
		posArr[i]     += pos[0];
		posArr[i + 1] += pos[1];
		posArr[i + 2] += pos[2];
	}

	const normArr = new Float32Array(normAttr.array);
	const idxArr  = new Uint16Array(idxAttr.array);

	const posBytes  = new Uint8Array(posArr.buffer);
	const normBytes = new Uint8Array(normArr.buffer);
	const idxBytes  = new Uint8Array(idxArr.buffer);

	const vertCount = posAttr.count;
	const idxCount  = idxAttr.count;

	// Min/max for positions (required by GLTF spec)
	let minPos = [Infinity, Infinity, Infinity];
	let maxPos = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < posArr.length; i += 3) {
		minPos[0] = Math.min(minPos[0], posArr[i]);
		minPos[1] = Math.min(minPos[1], posArr[i + 1]);
		minPos[2] = Math.min(minPos[2], posArr[i + 2]);
		maxPos[0] = Math.max(maxPos[0], posArr[i]);
		maxPos[1] = Math.max(maxPos[1], posArr[i + 1]);
		maxPos[2] = Math.max(maxPos[2], posArr[i + 2]);
	}

	const posAccIdx  = accessors.length;
	const normAccIdx = accessors.length + 1;
	const idxAccIdx  = accessors.length + 2;

	accessors.push(
		{ bufferView: bufferChunks.length, byteOffset: 0, componentType: 5126, count: vertCount, type: 'VEC3', min: minPos, max: maxPos },
		{ bufferView: bufferChunks.length + 1, byteOffset: 0, componentType: 5126, count: vertCount, type: 'VEC3' },
		{ bufferView: bufferChunks.length + 2, byteOffset: 0, componentType: 5123, count: idxCount, type: 'SCALAR' }
	);

	bufferChunks.push(
		{ data: posBytes,  byteLength: posBytes.byteLength,  target: 34962 },
		{ data: normBytes, byteLength: normBytes.byteLength, target: 34962 },
		{ data: idxBytes,  byteLength: idxBytes.byteLength,  target: 34963 }
	);

	meshPrimitives.push({
		attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
		indices: idxAccIdx,
		material: 0
	});
}

// Combine all chunks into one buffer
const totalBytes = bufferChunks.reduce((s, c) => s + c.byteLength, 0);
const combined   = new Uint8Array(totalBytes);
let offset = 0;
const bufferViews = [];

for (let i = 0; i < bufferChunks.length; i++) {
	const chunk = bufferChunks[i];
	combined.set(chunk.data, offset);
	bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: chunk.byteLength, target: chunk.target });
	// Update accessor to point to global bufferView index
	accessors[i].bufferView = i;
	offset += chunk.byteLength;
}

const bufferB64 = Buffer.from(combined).toString('base64');

const gltf = {
	asset: { version: '2.0', generator: 'generate-man.mjs' },
	scene: 0,
	scenes: [{ nodes: [0] }],
	nodes: [{ mesh: 0 }],
	meshes: [{ name: 'Man', primitives: meshPrimitives }],
	materials: [{
		name: 'ManMaterial',
		pbrMetallicRoughness: {
			baseColorFactor: [0, 1, 0, 1],
			metallicFactor: 0,
			roughnessFactor: 0.8
		}
	}],
	accessors,
	bufferViews,
	buffers: [{ uri: `data:application/octet-stream;base64,${bufferB64}`, byteLength: totalBytes }]
};

writeFileSync('./static/man.gltf', JSON.stringify(gltf));
console.log('static/man.gltf written');
