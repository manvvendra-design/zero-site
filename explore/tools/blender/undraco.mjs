import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
for (const [a, b] of [['lm_src.glb', 'lm_plain.glb'], ['astro_src.glb', 'astro_plain.glb']]) {
  const doc = await io.read(a);
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
  await io.write(b, doc); console.log('ok', b);
}
