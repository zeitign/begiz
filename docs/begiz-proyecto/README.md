# Fuente de `begiz-proyecto.pdf`

El PDF de la raíz del repositorio se genera a partir de `begiz-proyecto.html`, con las fuentes
IBM Plex (licencia OFL) en `fonts/`.

- Las partes 01–03 son una instantánea del inicio del proyecto y no se tocan. Los cambios de
  plan se añaden como partes nuevas, y se apuntan en la portada.
- El estado al día está siempre en `ARCHITECTURE.md`; el PDF solo recoge hitos.

## Regenerar el PDF

`print.mjs` imprime el HTML con un Chrome o Chromium abierto en modo depuración remota en el
puerto 9333 y añade el pie con el número de página.

```sh
chromium --headless --remote-debugging-port=9333 about:blank &
node docs/begiz-proyecto/print.mjs docs/begiz-proyecto/begiz-proyecto.html begiz-proyecto.pdf
```

Antes de dar el PDF por bueno, revisar que la portada cabe en una página.
