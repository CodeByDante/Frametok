"use strict";

const TIKWM_API = "https://www.tikwm.com/api/";
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);
const PHOTO_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);
const AUDIO_EXTENSIONS = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/aac", "aac"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/webm", "weba"],
]);
const VIDEO_EXTENSIONS = new Map([
  ["video/mp4", "mp4"],
  ["application/mp4", "mp4"],
]);
const VIDEO_FILENAME_BYTES = 120;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)\s*(?:\.|$)/i;

const page = document.querySelector(".page");
const stage = document.querySelector(".stage");
const form = document.querySelector("#link-form");
const input = document.querySelector("#post-link");
const pasteButton = document.querySelector("#paste-link");
const loadButton = document.querySelector("#load-photos");
const loadLabel = loadButton.querySelector("span");
const formStatus = document.querySelector("#form-status");
const downloadStatus = document.querySelector("#download-status");
const audioButton = document.querySelector("#download-audio");
const audioPlayer = document.querySelector("#audio-player");
const carouselAudio = document.querySelector("#carousel-audio");
const zipButton = document.querySelector("#download-zip");
const mp4Button = document.querySelector("#download-mp4");
const mp3Button = document.querySelector("#download-mp3");
const carouselActions = document.querySelector("#carousel-actions");
const videoPanel = document.querySelector("#video-panel");
const videoPlayer = document.querySelector("#video-player");
const photoCount = document.querySelector("#photo-count");
const galleryTitle = document.querySelector("#gallery-title");
const publication = document.querySelector("#publication");
const results = document.querySelector("#results");
const gallery = document.querySelector("#photo-gallery");
let activePublication;

function announce(element, message = "", error = false) {
  element.hidden = !message;
  element.textContent = message;
  element.dataset.error = String(error);
}

function getPublicationLink(value) {
  const text = value.trim();
  const sharedUrl = text.match(/(?:^|\s)(https?:\/\/[^\s<>"']+)/i)?.[1] ?? text;
  const candidate = sharedUrl.replace(/[.,;!?)\]]+$/, "");
  const link = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  if (!TIKTOK_HOSTS.has(link.hostname) || link.username || link.password || link.port) {
    throw new Error("Pega un enlace de TikTok.");
  }

  const path = link.pathname;
  const fullPost = /^\/@[\w.-]+\/(?:photo|video)\/\d+\/?$/.test(path);
  const shareCode = /^\/t\/[\w-]+\/?$/.test(path);
  const shortLink = SHORT_HOSTS.has(link.hostname) && /^\/[\w-]+\/?$/.test(path);
  if (!fullPost && !shareCode && !shortLink) {
    throw new Error("Copia el enlace de la publicación desde Compartir en TikTok.");
  }

  link.protocol = "https:";
  link.search = "";
  link.hash = "";
  return link.href;
}

function getMediaLink(rawLink) {
  if (typeof rawLink !== "string" || !rawLink.trim()) {
    return null;
  }

  try {
    const url = new URL(rawLink, TIKWM_API);
    const allowedHost = /(?:^|\.)(?:tiktokcdn(?:-[a-z0-9]+)*\.com|tiktokv\.com|tiktok\.com|ibytedtos\.com|tikwm\.com)$/.test(url.hostname);
    const allowed = url.protocol === "https:" && allowedHost && !url.username && !url.password && !url.port;
    return allowed ? url.href : null;
  } catch {
    return null;
  }
}

function getImageLink(rawLink) {
  const url = getMediaLink(rawLink);
  if (!url) {
    throw new Error("TikWM devolvió una dirección de foto inválida. Vuelve a cargar el carrusel.");
  }
  return url;
}

function getMediaLinks(...links) {
  return [...new Set(links.map(getMediaLink).filter(Boolean))];
}

function safeFileStem(value) {
  if (typeof value !== "string") {
    return "";
  }
  const cleaned = value.normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[ .-]+|[ .-]+$/g, "");
  const stem = WINDOWS_DEVICE_NAME.test(cleaned) ? `_${cleaned}` : cleaned;
  const encoder = new TextEncoder();
  let size = 0;
  let name = "";
  for (const character of stem) {
    size += encoder.encode(character).length;
    if (size > VIDEO_FILENAME_BYTES) {
      break;
    }
    name += character;
  }
  return name.replace(/[ .-]+$/g, "");
}

function request(url, signal, timeout) {
  return fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
  });
}

async function loadPublication(link, signal) {
  const endpoint = new URL(TIKWM_API);
  endpoint.searchParams.set("url", link);
  const response = await request(endpoint, signal, 25000);
  if (response.status === 429) {
    throw new Error("TikWM recibió demasiadas consultas. Inténtalo en unos segundos.");
  }
  if (!response.ok) {
    throw new Error("TikWM no está disponible en este momento. Inténtalo de nuevo.");
  }
  const payload = await response.json();
  if (payload.code !== 0 || !payload.data) {
    throw new Error("No se encontró la publicación. Comprueba que el enlace abra un carrusel o video público.");
  }
  const {
    images, author, id, title, music, music_info: musicInfo, play, wmplay, cover, origin_cover: originCover,
  } = payload.data;
  const details = {
    id: /^\d+$/.test(String(id)) ? String(id) : "",
    author: typeof author?.unique_id === "string" ? author.unique_id : "",
  };
  if (Array.isArray(images) && images.length > 0) {
    return {
      ...details,
      type: "carousel",
      audioLinks: getMediaLinks(music, musicInfo?.play),
      photos: images.map((image, index) => ({
        url: getImageLink(image),
        number: String(index + 1).padStart(Math.max(2, String(images.length).length), "0"),
      })),
    };
  }

  const videoLinks = getMediaLinks(play, wmplay);
  if (videoLinks.length > 0) {
    const poster = getMediaLink(cover) ?? getMediaLink(originCover);
    const { hostname, pathname } = new URL(link);
    const downloadName = safeFileStem(title) || safeFileStem(hostname + pathname);
    return { ...details, type: "video", videoLinks, poster, downloadName };
  }

  throw new Error("No se pudo obtener el contenido de esta publicación. Vuelve a cargarla o prueba otro enlace.");
}

function getPhotoFile(photo, signal) {
  if (!photo.file) {
    photo.file = (async () => {
      const response = await request(photo.url, signal, 45000);
      const mime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
      const extension = PHOTO_EXTENSIONS.get(mime);
      if (!response.ok || !extension) {
        throw new Error("No se recibió una imagen válida.");
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("La imagen llegó vacía.");
      }
      return { blob, name: `foto-${photo.number}.${extension}` };
    })().catch(() => {
      delete photo.file;
      throw new Error(`No se pudo descargar la foto ${photo.number}. Inténtalo de nuevo.`);
    });
  }
  return photo.file;
}

async function getMediaFile(links, signal, extensions, timeout) {
  for (const link of links) {
    try {
      const response = await request(link, signal, timeout);
      const mime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
      const extension = extensions.get(mime);
      if (!response.ok || !extension) {
        continue;
      }
      const blob = await response.blob();
      if (blob.size > 0) {
        return { blob, extension };
      }
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
    }
  }

  return null;
}

function getVideoBlob(video, signal) {
  if (!video.file) {
    video.file = getMediaFile(video.videoLinks, signal, VIDEO_EXTENSIONS, 120000)
      .then((file) => {
        if (!file) {
          throw new Error("No se pudo obtener el video en MP4. Vuelve a cargar la publicación e inténtalo de nuevo.");
        }
        return file.blob;
      })
      .catch((error) => {
        delete video.file;
        throw error;
      });
  }
  return video.file;
}

async function encodeMp3(audio, signal) {
  const samples = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel).slice());
  const worker = new Worker("./mp3-worker.js");
  let cancel;
  try {
    return await new Promise((resolve, reject) => {
      cancel = () => reject(signal.reason);
      worker.onmessage = ({ data }) => {
        if (data instanceof Blob && data.size > 0) {
          resolve(data);
        } else {
          reject(new Error("No se pudo generar el archivo MP3."));
        }
      };
      worker.onerror = () => reject(new Error("No se pudo generar el archivo MP3."));
      signal.addEventListener("abort", cancel, { once: true });
      worker.postMessage({ samples, sampleRate: audio.sampleRate }, samples.map((channel) => channel.buffer));
    });
  } finally {
    signal.removeEventListener("abort", cancel);
    worker.terminate();
  }
}

async function convertVideoToMp3(blob, signal) {
  let audio;
  try {
    const decoder = new OfflineAudioContext(2, 1, 44100);
    audio = await decoder.decodeAudioData(await blob.arrayBuffer());
    if (audio.numberOfChannels > 2) {
      const mixer = new OfflineAudioContext(2, audio.length, audio.sampleRate);
      const source = mixer.createBufferSource();
      source.buffer = audio;
      source.connect(mixer.destination);
      source.start();
      audio = await mixer.startRendering();
    }
  } catch {
    throw new Error("No se pudo leer la pista de audio de este video.");
  }
  signal.throwIfAborted();
  return encodeMp3(audio, signal);
}

function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadPhoto(photo, button, signal) {
  button.disabled = true;
  button.textContent = "Guardando…";
  announce(downloadStatus);
  try {
    const { blob, name } = await getPhotoFile(photo, signal);
    if (!signal.aborted) {
      saveFile(blob, name);
      announce(downloadStatus, `Archivo preparado: ${name}.`);
    }
  } catch (error) {
    if (!signal.aborted) {
      announce(downloadStatus, error.message, true);
    }
  } finally {
    button.textContent = "Descargar";
    button.disabled = false;
  }
}

function buildPhotoCard(photo, signal, index) {
  const card = document.createElement("li");
  card.className = "photo-card";
  card.style.setProperty("--reveal-delay", `${220 + Math.min(index, 10) * 45}ms`);
  const preview = document.createElement("div");
  preview.className = "photo-preview";
  const image = new Image();
  image.alt = `Foto ${photo.number} del carrusel`;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.crossOrigin = "anonymous";
  image.addEventListener("error", () => {
    const message = document.createElement("p");
    message.textContent = "Vista previa no disponible";
    preview.replaceChildren(message);
  }, { once: true });
  image.src = photo.url;
  preview.append(image);

  const controls = document.createElement("div");
  controls.className = "photo-details";
  const label = document.createElement("p");
  label.className = "photo-label";
  label.textContent = `Foto ${photo.number}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-photo";
  button.textContent = "Descargar";
  button.setAttribute("aria-label", `Descargar foto ${photo.number}`);
  button.addEventListener("click", () => downloadPhoto(photo, button, signal));
  controls.append(label, button);
  card.append(preview, controls);
  return card;
}

function setPlayerSources(player, links) {
  player.replaceChildren(...links.map((link) => {
    const source = document.createElement("source");
    source.src = link;
    return source;
  }));
  player.load();
}

function resetPlayer(player, panel) {
  if (!panel.hidden) {
    player.pause();
    setPlayerSources(player, []);
    panel.hidden = true;
  }
}

function showCarousel({ photos, audioLinks, controller }) {
  gallery.replaceChildren(...photos.map((photo, index) => buildPhotoCard(photo, controller.signal, index)));
  photoCount.textContent = `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`;
  const hasAudio = audioLinks.length > 0;
  carouselAudio.hidden = !hasAudio;
  audioButton.disabled = false;
  if (hasAudio) {
    setPlayerSources(audioPlayer, audioLinks);
  }
  zipButton.disabled = false;
}

function showPublication(data) {
  const isCarousel = data.type === "carousel";
  galleryTitle.textContent = isCarousel ? "Fotos del carrusel" : "Video de TikTok";
  photoCount.hidden = !isCarousel;
  carouselActions.hidden = !isCarousel;
  gallery.hidden = !isCarousel;
  publication.href = data.link;
  publication.textContent = data.author ? `@${data.author} en TikTok` : "Ver en TikTok";
  if (isCarousel) {
    showCarousel(data);
  } else {
    if (data.poster) {
      videoPlayer.poster = data.poster;
    }
    setPlayerSources(videoPlayer, data.videoLinks);
    videoPanel.hidden = false;
    mp4Button.disabled = false;
    mp3Button.disabled = false;
  }
  results.hidden = false;
}

pasteButton.addEventListener("click", async () => {
  try {
    const clipboard = await navigator.clipboard.readText();
    if (clipboard) {
      input.value = clipboard.trim();
      input.removeAttribute("aria-invalid");
      announce(formStatus);
    }
  } catch {
    announce(formStatus, "Usa Ctrl+V o mantén pulsado el campo para pegar el enlace.");
  }
  input.focus();
});

input.addEventListener("input", () => {
  input.removeAttribute("aria-invalid");
  if (!loadButton.disabled) {
    announce(formStatus);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loadButton.disabled) {
    return;
  }
  let link;
  try {
    link = getPublicationLink(input.value);
  } catch (error) {
    input.setAttribute("aria-invalid", "true");
    announce(formStatus, error instanceof TypeError ? "El enlace de TikTok no es válido." : error.message, true);
    input.focus();
    return;
  }

  activePublication?.controller.abort();
  activePublication = undefined;
  resetPlayer(audioPlayer, carouselAudio);
  resetPlayer(videoPlayer, videoPanel);
  videoPlayer.removeAttribute("poster");
  gallery.replaceChildren();
  results.hidden = true;
  loadButton.disabled = true;
  loadLabel.textContent = "Preparando…";
  input.removeAttribute("aria-invalid");
  announce(formStatus, "Consultando la publicación…");
  announce(downloadStatus);
  page.classList.add("results-open");
  const controller = new AbortController();
  try {
    const movement = stage.getAnimations?.().find((animation) => animation.transitionProperty === "min-height");
    const [data] = await Promise.all([loadPublication(link, controller.signal), movement?.finished.catch(() => {})]);
    activePublication = { ...data, link, controller };
    showPublication(activePublication);
    announce(formStatus);
  } catch (error) {
    page.classList.remove("results-open");
    const connectionError = error instanceof TypeError || error.name === "TimeoutError" || error instanceof SyntaxError;
    const message = connectionError ? "No se pudo consultar TikWM. Inténtalo de nuevo." : error.message;
    announce(formStatus, message, true);
  } finally {
    loadButton.disabled = false;
    loadLabel.textContent = "Descargar";
  }
});

audioButton.addEventListener("click", async () => {
  if (!activePublication?.audioLinks?.length || audioButton.disabled) {
    return;
  }
  const { controller: { signal }, audioLinks, id } = activePublication;
  audioButton.disabled = true;
  announce(downloadStatus, "Preparando audio…");
  try {
    const file = await getMediaFile(audioLinks, signal, AUDIO_EXTENSIONS, 45000);
    if (!file) {
      throw new Error("No se pudo descargar el audio. Vuelve a cargar el carrusel e inténtalo de nuevo.");
    }
    const { blob, extension } = file;
    if (!signal.aborted) {
      const name = id ? `frametok-audio-${id}.${extension}` : `frametok-audio.${extension}`;
      saveFile(blob, name);
      announce(downloadStatus, "Audio listo para descargar.");
    }
  } catch (error) {
    if (!signal.aborted) {
      announce(downloadStatus, error.message, true);
    }
  } finally {
    if (!signal.aborted) {
      audioButton.disabled = false;
    }
  }
});

async function downloadVideo(format, button) {
  const video = activePublication;
  if (video?.type !== "video" || button.disabled) {
    return;
  }
  const { controller: { signal }, downloadName } = video;
  button.disabled = true;
  announce(downloadStatus, "Obteniendo el video…");
  try {
    let blob = await getVideoBlob(video, signal);
    signal.throwIfAborted();
    if (format === "mp3") {
      announce(downloadStatus, "Convirtiendo el audio a MP3…");
      blob = await convertVideoToMp3(blob, signal);
    }
    if (!signal.aborted) {
      saveFile(blob, `${downloadName}.${format}`);
      announce(downloadStatus, format === "mp3" ? "MP3 listo para descargar." : "MP4 listo para descargar.");
    }
  } catch (error) {
    if (!signal.aborted) {
      announce(downloadStatus, error.message, true);
    }
  } finally {
    if (!signal.aborted) {
      button.disabled = false;
    }
  }
}

mp4Button.addEventListener("click", () => downloadVideo("mp4", mp4Button));
mp3Button.addEventListener("click", () => downloadVideo("mp3", mp3Button));

zipButton.addEventListener("click", async () => {
  if (activePublication?.type !== "carousel" || zipButton.disabled) {
    return;
  }
  const { controller: { signal }, photos, id } = activePublication;
  zipButton.disabled = true;
  announce(downloadStatus, "Preparando ZIP…");
  try {
    const zip = new JSZip();
    const batchSize = 4;
    for (let index = 0; index < photos.length; index += batchSize) {
      const batch = photos.slice(index, index + batchSize);
      const files = await Promise.all(batch.map((photo) => getPhotoFile(photo, signal)));
      if (signal.aborted) {
        return;
      }
      for (const { blob, name } of files) {
        zip.file(name, blob);
      }
      announce(downloadStatus, `Preparando ZIP · ${index + files.length} de ${photos.length} fotos`);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    if (!signal.aborted) {
      saveFile(blob, id ? `frametok-${id}.zip` : "frametok.zip");
      announce(downloadStatus, "ZIP listo para descargar.");
    }
  } catch (error) {
    if (!signal.aborted) {
      announce(downloadStatus, error.message, true);
    }
  } finally {
    if (!signal.aborted) {
      zipButton.disabled = false;
    }
  }
});
