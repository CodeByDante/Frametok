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

const form = document.querySelector("#link-form");
const input = document.querySelector("#post-link");
const pasteButton = document.querySelector("#paste-link");
const loadButton = document.querySelector("#load-photos");
const loadLabel = loadButton.querySelector("span");
const formStatus = document.querySelector("#form-status");
const downloadStatus = document.querySelector("#download-status");
const zipButton = document.querySelector("#download-zip");
const photoCount = document.querySelector("#photo-count");
const publication = document.querySelector("#publication");
const emptyGallery = document.querySelector("#empty-gallery");
const emptyText = document.querySelector("#empty-text");
const gallery = document.querySelector("#photo-gallery");
let activeCarousel;

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
    throw new Error("Copia el enlace de la publicación de fotos desde Compartir en TikTok.");
  }

  link.protocol = "https:";
  link.search = "";
  link.hash = "";
  return link.href;
}

function getImageLink(rawLink) {
  if (typeof rawLink !== "string") {
    throw new Error("TikWM devolvió una dirección de foto inválida. Vuelve a cargar el carrusel.");
  }
  const url = new URL(rawLink, TIKWM_API);
  const allowedHost = /(?:^|\.)(?:tiktokcdn(?:-[a-z0-9]+)*\.com|tiktokv\.com|tiktok\.com|ibytedtos\.com|tikwm\.com)$/.test(url.hostname);
  if (url.protocol !== "https:" || !allowedHost || url.username || url.password || url.port) {
    throw new Error("TikWM devolvió una dirección de foto inválida. Vuelve a cargar el carrusel.");
  }
  return url.href;
}

function request(url, signal, timeout) {
  return fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
  });
}

async function loadCarousel(link, signal) {
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
    throw new Error("No se encontró la publicación. Comprueba que el enlace abra un carrusel público.");
  }
  const { images, author, id } = payload.data;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("La publicación no contiene un carrusel de fotos disponible.");
  }
  return {
    id: /^\d+$/.test(String(id)) ? String(id) : "",
    author: typeof author?.unique_id === "string" ? author.unique_id : "",
    photos: images.map((image, index) => ({
      url: getImageLink(image),
      number: String(index + 1).padStart(Math.max(2, String(images.length).length), "0"),
    })),
  };
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
    button.textContent = "Descargar ↓";
    button.disabled = false;
  }
}

function buildPhotoCard(photo, signal) {
  const card = document.createElement("li");
  card.className = "photo-card";
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
  button.textContent = "Descargar ↓";
  button.setAttribute("aria-label", `Descargar foto ${photo.number}`);
  button.addEventListener("click", () => downloadPhoto(photo, button, signal));
  controls.append(label, button);
  card.append(preview, controls);
  return card;
}

function showCarousel({ photos, author, link, controller }) {
  gallery.replaceChildren(...photos.map((photo) => buildPhotoCard(photo, controller.signal)));
  photoCount.textContent = `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`;
  publication.href = link;
  publication.textContent = author ? `@${author} en TikTok ↗` : "Ver en TikTok ↗";
  emptyGallery.hidden = true;
  gallery.hidden = publication.hidden = photoCount.hidden = zipButton.hidden = false;
  zipButton.disabled = false;
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

  activeCarousel?.controller.abort();
  activeCarousel = undefined;
  gallery.replaceChildren();
  gallery.hidden = publication.hidden = photoCount.hidden = zipButton.hidden = true;
  emptyGallery.hidden = false;
  emptyText.textContent = "Buscando las fotos del carrusel…";
  loadButton.disabled = true;
  loadLabel.textContent = "Cargando fotos…";
  input.removeAttribute("aria-invalid");
  announce(formStatus, "Consultando la publicación…");
  announce(downloadStatus);
  const controller = new AbortController();
  try {
    const data = await loadCarousel(link, controller.signal);
    activeCarousel = { ...data, link, controller };
    showCarousel(activeCarousel);
    announce(formStatus, data.photos.length === 1 ? "Se encontró 1 foto." : `Se encontraron ${data.photos.length} fotos.`);
  } catch (error) {
    const connectionError = error instanceof TypeError || error.name === "TimeoutError" || error instanceof SyntaxError;
    const message = connectionError ? "No se pudo consultar TikWM. Inténtalo de nuevo." : error.message;
    announce(formStatus, message, true);
    emptyText.textContent = "Las fotos del carrusel aparecerán aquí.";
  } finally {
    loadButton.disabled = false;
    loadLabel.textContent = "Cargar fotos";
  }
});

zipButton.addEventListener("click", async () => {
  if (!activeCarousel || zipButton.disabled) {
    return;
  }
  const { controller: { signal }, photos, id } = activeCarousel;
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
      saveFile(blob, id ? `tikstash-${id}.zip` : "tikstash.zip");
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
