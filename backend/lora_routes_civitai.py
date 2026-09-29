"""LoRA Civitai sync route: fetches metadata and previews for LoRAs by file hash."""

from urllib.parse import urlparse
import os
import tempfile

from aiohttp import web
import aiohttp
import folder_paths
import server

from .lora_library import METADATA_LOCK, load_metadata, save_metadata
from .lora_lookup import calculate_sha256, get_metadata_for_lora
from .lora_previews import IMAGE_EXTENSIONS, get_lora_preview_asset_info

CIVITAI_API_BASE_URL = "https://civitai.com"
CIVITAI_WEB_BASE_URL = os.environ.get("LOCAL_LORA_GALLERY_CIVITAI_WEB_BASE_URL", "https://civitai.red").rstrip("/")


@server.PromptServer.instance.routes.post("/localgalleryunified/lora/sync_civitai")
async def sync_civitai_metadata(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        if not lora_name:
            return web.json_response({"status": "error", "message": "Missing lora_name"}, status=400)

        lora_full_path = folder_paths.get_full_path("loras", lora_name)
        if not lora_full_path:
            return web.json_response({"status": "error", "message": "LoRA file not found"}, status=404)

        with METADATA_LOCK:
            metadata = load_metadata()
            lora_meta, metadata_changed = get_metadata_for_lora(metadata, lora_name, lora_full_path, ensure_hash=True, create_missing=True)

            model_hash = lora_meta.get('hash')
            if not model_hash:
                print(f"Local Lora Gallery: Calculating hash for {lora_name}...")
                model_hash = calculate_sha256(lora_full_path)
                if model_hash:
                    lora_meta['hash'] = model_hash
                    metadata_changed = True
                else:
                    raise ValueError("Failed to calculate hash")

            if metadata_changed:
                save_metadata(metadata)

        civitai_version_url = f"{CIVITAI_API_BASE_URL}/api/v1/model-versions/by-hash/{model_hash}"
        async with aiohttp.ClientSession() as session:
            async with session.get(civitai_version_url) as response:
                if response.status != 200:
                    return web.json_response({"status": "error", "message": f"Civitai API (version) returned {response.status}. Model not found or API error."}, status=response.status)
                
                civitai_version_data = await response.json()
                model_id = civitai_version_data.get('modelId')
                if not model_id:
                    return web.json_response({"status": "error", "message": "Could not find modelId in Civitai API response."}, status=500)

            # civitai_model_url = f"{CIVITAI_API_BASE_URL}/api/v1/models/{model_id}"
            # async with session.get(civitai_model_url) as response:
            #     if response.status != 200:
            #         print(f"Local Lora Gallery: Warning - Could not fetch model details for tags. Status: {response.status}")
            #         civitai_model_data = {}
            #     else:
            #         civitai_model_data = await response.json()

            images = civitai_version_data.get('images', [])
            if not images:
                print("Local Lora Gallery: No preview images found on Civitai, but will save other metadata.")
            else:
                preview_media = next((img for img in images if img.get('type') == 'image'), images[0])
                preview_url = preview_media.get('url')
                is_video = preview_media.get('type') == 'video'

                try:
                    if is_video:
                        if '/original=true/' in preview_url:
                            temp_url = preview_url.replace('/original=true/', '/transcode=true,width=450,optimized=true/')
                            final_url = os.path.splitext(temp_url)[0] + '.webm'
                        else:
                            url_obj = urlparse(preview_url)
                            path_parts = url_obj.path.split('/')
                            filename = path_parts.pop()
                            filename_base = os.path.splitext(filename)[0]
                            new_path = f"{'/'.join(path_parts)}/transcode=true,width=450,optimized=true/{filename_base}.webm"
                            final_url = url_obj._replace(path=new_path).geturl()
                        file_ext = '.webm'
                    else:
                        if '/original=true/' in preview_url:
                           final_url = preview_url.replace('/original=true/', '/width=450/')
                        else:
                            final_url = preview_url.replace('/width=\d+/', '/width=450/') if '/width=' in preview_url else preview_url.replace(urlparse(preview_url).path, f"/width=450{urlparse(preview_url).path}")

                        path = urlparse(final_url).path
                        file_ext = os.path.splitext(path)[1]
                        if not file_ext or file_ext.lower() not in IMAGE_EXTENSIONS:
                            file_ext = '.jpg'
                except Exception as e:
                    print(f"Local Lora Gallery: Failed to parse or modify URL '{preview_url}'. Error: {e}")
                    final_url = preview_url
                    file_ext = '.jpg' if not is_video else '.mp4'

                lora_dir = os.path.dirname(lora_full_path)
                lora_basename = os.path.splitext(os.path.basename(lora_full_path))[0]
                save_path = os.path.join(lora_dir, lora_basename + file_ext)

                async with session.get(final_url) as download_response:
                    if download_response.status != 200:
                        print(f"Local Lora Gallery: Warning - Failed to download preview from {final_url}. Proceeding without preview.")
                    else:
                        temp_preview_path = None
                        try:
                            with tempfile.NamedTemporaryFile('wb', dir=lora_dir, delete=False) as f:
                                temp_preview_path = f.name
                                while True:
                                    chunk = await download_response.content.read(8192)
                                    if not chunk:
                                        break
                                    f.write(chunk)
                                f.flush()
                                os.fsync(f.fileno())
                            os.replace(temp_preview_path, save_path)
                            temp_preview_path = None
                        finally:
                            if temp_preview_path and os.path.exists(temp_preview_path):
                                os.remove(temp_preview_path)
                        print(f"Local Lora Gallery: Successfully downloaded preview to '{save_path}'")

            trained_words = civitai_version_data.get('trainedWords', [])
            # Network and download operations above may take long enough for a user to
            # edit metadata concurrently. Reload under the metadata lock so sync only
            # merges its own fields instead of overwriting the newer file with a stale
            # snapshot.
            with METADATA_LOCK:
                metadata = load_metadata()
                lora_meta, _ = get_metadata_for_lora(
                    metadata,
                    lora_name,
                    lora_full_path,
                    ensure_hash=False,
                    create_missing=True,
                )
                lora_meta['hash'] = model_hash
                if trained_words:
                    lora_meta['trigger_words'] = ", ".join(trained_words)

                lora_meta['download_url'] = f"{CIVITAI_WEB_BASE_URL}/models/{model_id}"

                # tags = set(lora_meta.get('tags', []))
                # if 'tags' in civitai_model_data:
                #     for tag in civitai_model_data['tags']:
                #         tags.add(tag)
                # lora_meta['tags'] = sorted(list(tags))

                save_metadata(metadata)
            
            new_local_url, new_preview_type = get_lora_preview_asset_info(lora_name)
            
            return web.json_response({
                "status": "ok", 
                "metadata": { "preview_url": new_local_url, "preview_type": new_preview_type, **lora_meta }
            })

    except Exception as e:
        import traceback
        print(f"Error in sync_civitai_metadata: {traceback.format_exc()}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
