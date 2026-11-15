# Frametok

Pega el enlace de una publicación pública de TikTok y pulsa **Descargar**. El formulario sube y el resultado aparece debajo.

Las fotos de un carrusel aparecen en orden. Puedes guardar cada imagen o reunirlas con **Descargar fotos en ZIP**. Los archivos se numeran como `foto-01.jpg`, `foto-02.jpg` y conservan el formato que entrega el servidor.

Si el carrusel tiene una pista disponible, puedes escucharla, avanzar con la barra y ajustar el volumen. Guárdala por separado con **Descargar audio**.

En una publicación de video, el bloque se ajusta a la proporción de la vista previa. Debajo aparecen **Descargar MP3** y **Descargar MP4**. El MP3 se genera en el navegador a partir del audio del video. Ambos archivos usan el título de la publicación o el enlace si el título está vacío o solo tiene hashtags. La aplicación adapta los caracteres para Windows y limita la longitud del nombre.

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
