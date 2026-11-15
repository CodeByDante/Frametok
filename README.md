# Carrusel TikTok

Pega el enlace de una publicación pública de fotos de TikTok para ver las imágenes en orden. Puedes guardar cada foto o descargar todo en un ZIP, con los archivos numerados y en el formato que entrega el servidor.

[Abrir Carrusel TikTok](https://codebydante.github.io/carrusel-tiktok/)

## Ejecutar en local

```sh
python3 -m http.server 8000
```

Abre [localhost en el puerto 8000](http://localhost:8000/) desde el navegador. Para publicar el sitio en GitHub Pages, selecciona **Deploy from a branch** en **Settings → Pages**, con la rama `main` y la carpeta `/ (root)`.

## Cómo funciona

La interfaz envía a la [API pública de TikWM](https://www.tikwm.com/) el enlace de la publicación, sin sus parámetros de seguimiento. El navegador obtiene las fotos de las direcciones que devuelve la API y [JSZip](https://stuk.github.io/jszip/) arma el archivo ZIP de forma local. Si TikWM limita las consultas o TikTok deja de servir una foto, la aplicación muestra el error y permite reintentar.

Puedes probar con [este carrusel público de siete fotos](https://www.tiktok.com/@adventurers00/photo/7684712891978665249).

JSZip y Geist conservan sus licencias en `vendor/JSZip-LICENSE.markdown` y `assets/Geist-OFL.txt`.
