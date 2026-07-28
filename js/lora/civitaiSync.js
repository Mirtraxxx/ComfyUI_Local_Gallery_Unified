import * as loraApi from "../api/loraApi.js";
import { escapeHtml, sanitizeHttpUrl } from "../shared/dom.js?v=url-safety-20260712";

/** Synchronizes one LoRA card and updates the node's cached metadata/UI. */
export async function syncLoraWithCivitai({
    loraName,
    card,
    nodeInstance,
    loraIconSvg,
}) {
        const syncBtn = card.querySelector('.sync-civitai-btn');
         syncBtn.innerHTML = loraIconSvg.sync;
        syncBtn.title = "Syncing with Civitai";
        syncBtn.classList.remove('error');
        syncBtn.classList.add('loading');

        try {
            const result = await loraApi.syncCivitai(loraName);

            if (result.status === 'ok' && result.metadata) {
                const { preview_url, preview_type, trigger_words, download_url, tags } = result.metadata;

                const loraInDataSource = nodeInstance.availableLoras.find(l => l.name === loraName);
                if (loraInDataSource) {
                    loraInDataSource.preview_url = preview_url || '';
                    loraInDataSource.preview_type = preview_type || 'none';
                    loraInDataSource.trigger_words = trigger_words || '';
                    loraInDataSource.download_url = download_url || '';
                    loraInDataSource.tags = tags || [];
                }

                const mediaContainer = card.querySelector('.locallora-media-container');
                if (mediaContainer) {
                    if (preview_type === 'video' && preview_url) {
                        mediaContainer.innerHTML = `<video muted loop playsinline src="${escapeHtml(preview_url)}"></video>`;
                        const video = mediaContainer.querySelector('video');
                        card.addEventListener('mouseenter', () => video.play().catch(e => {}));
                        card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
                    } else if (preview_type === 'image' && preview_url) {
                        mediaContainer.innerHTML = `<img src="${escapeHtml(preview_url)}">`;
                    } else {
                        const empty_lora_image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        mediaContainer.innerHTML = `<img src="${empty_lora_image}">`;
                    }
                }
                 const triggerEl = card.querySelector('.lora-card-triggers');
                if(triggerEl) {
                   triggerEl.textContent = trigger_words || 'No triggers';
                   triggerEl.title = trigger_words || '';
                }
                card.dataset.triggerWords = trigger_words || '';
                card.dataset.downloadUrl = download_url || '';
                const oldLinkBtn = card.querySelector('.lora-card-link-btn');
                if(oldLinkBtn) oldLinkBtn.remove();
                const safeDownloadUrl = sanitizeHttpUrl(download_url);
                if(safeDownloadUrl){
                    const linkBtn = document.createElement('a');
                    linkBtn.href = safeDownloadUrl;
                    linkBtn.target = '_blank';
                    linkBtn.rel = 'noopener noreferrer';
                    linkBtn.className = 'card-btn lora-card-link-btn';
                    linkBtn.title = 'Open download page';
                    linkBtn.setAttribute('aria-label', 'Open download page');
                    linkBtn.innerHTML = loraIconSvg.link;
                    linkBtn.addEventListener('click', e => e.stopPropagation());
                    card.prepend(linkBtn);
                }

            } else {
               throw new Error(result.message || 'Sync failed');
            }

        } catch (error) {
            console.error("LocalLoraGallery: Failed to sync with Civitai:", error);
            syncBtn.innerHTML = loraIconSvg.alert;
            syncBtn.title = "Civitai sync failed";
            syncBtn.classList.add('error');
            setTimeout(() => {
                syncBtn.innerHTML = loraIconSvg.sync;
                syncBtn.title = "Sync with Civitai";
                syncBtn.classList.remove('error');
            }, 2000);
        } finally {
            syncBtn.classList.remove('loading');
            if (!syncBtn.classList.contains('error')) {
                syncBtn.innerHTML = loraIconSvg.sync;
                syncBtn.title = "Sync with Civitai";
            }
        }
    }
