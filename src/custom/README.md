# src/custom — zona di codice su misura del singolo sito

Qui va il **codice specifico di questo sito** che **non** deve essere propagato
dal template né sovrascritto da un update.

- Tutto ciò che sta in `src/custom/**` è marcato `merge=local` in `.gitattributes`:
  durante un `bb-wizard update` il template non lo tocca mai.
- Usala solo quando una personalizzazione **non** è esprimibile come
  configurazione (`src/data/*.json`, modificabile dal pannello admin). Prima
  chiediti sempre: «posso renderla un'opzione nel core?». Se sì, va nel core del
  template (così la capacità arriva a tutti), non qui.

Esempi tipici: un componente su misura importato da una pagina, un override di
stile, una piccola integrazione richiesta da quel solo cliente.

> Le tre zone del progetto (vedi `FLEET.md`):
> **core** = `src/` condiviso e aggiornabile · **config** = `src/data/*.json` per-sito ·
> **override** = `src/custom/**` per-sito.
