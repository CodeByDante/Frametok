# Frametok

Pega el enlace de una publicación pública de fotos de TikTok para ver las imágenes en orden. Puedes guardar cada foto o reunirlas con **Descargar fotos en ZIP**, con los archivos numerados y en el formato que entrega el servidor.

Si el carrusel tiene una pista disponible, puedes escucharla en el reproductor y guardarla por separado con **Descargar audio**.

Para una publicación de video, usa **Descargar MP4** para guardar el video o **Descargar MP3** para convertir su pista de audio en el navegador.

[Abrir Frametok](https://codebydante.github.io/Frametok/)

## Ejecutar en local

```sh
python3 -m http.server 8000
```

Abre [localhost en el puerto 8000](http://localhost:8000/) desde el navegador. Para publicar el sitio en GitHub Pages, selecciona **Deploy from a branch** en **Settings → Pages**, con la rama `main` y la carpeta `/ (root)`.

## Cómo funciona

La interfaz envía a la API pública de TikWM el enlace de la publicación, sin sus parámetros de seguimiento. El navegador obtiene los archivos disponibles y crea el ZIP de fotos con JSZip. La conversión del audio de un video a MP3 usa LAME en el navegador. Si el servicio limita las consultas o una publicación deja de estar disponible, la aplicación muestra un error y permite reintentar. [TikWM](https://www.tikwm.com/) · [JSZip](https://stuk.github.io/jszip/) · [Licencia de LAME](vendor/lamejs-LICENSE.txt)

Puedes probar con [este carrusel público de siete fotos](https://www.tiktok.com/@adventurers00/photo/7684712891978665249).

JSZip e Inter conservan sus licencias en `vendor/JSZip-LICENSE.markdown` y `assets/Inter-OFL.txt`.
