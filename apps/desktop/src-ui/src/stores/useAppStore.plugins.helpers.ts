import type { PluginManifest } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';
import { buildPluginList, setPlugins } from '@/plugins/registry';
import { syncManifestsToBackend } from '@/plugins/loader';

export async function loadRuntimePluginManifests(): Promise<PluginManifest[]> {
  await syncManifestsToBackend();
  const manifests = await invoke<PluginManifest[]>('list_plugins');
  setPlugins(buildPluginList(manifests));
  return manifests;
}
