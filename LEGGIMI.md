# Palestra: come installarla sul telefono

È una PWA come "Spese di Casa": si pubblica gratis su GitHub Pages e si installa da Chrome su Android. Dati e foto restano solo sul telefono.

## Pubblicazione (una volta sola)
1. Su GitHub crea un nuovo repository pubblico, per esempio `palestra`.
2. **Add file → Upload files**: trascina il *contenuto* di questa cartella (`index.html`, `app.js`, `exercises.js`, `styles.css`, `sw.js`, `manifest.webmanifest` e la cartella `icons`). Poi **Commit changes**.
3. **Settings → Pages**: Branch `main`, cartella `/ (root)`, **Save**.
4. Dopo 1–2 minuti l'app è su `https://TUO-UTENTE.github.io/palestra/`.

## Installazione
Apri l'indirizzo con Chrome sul telefono → menu ⋮ → **Installa app**.
Al primo "Concludi giornata" Chrome chiede il permesso per la fotocamera: consentilo.

## Da sapere
- **Foto di convalida:** si scatta solo dentro l'app, con data, ora e nome della giornata impressi sull'immagine. Se la fotocamera interna non parte, il pulsante 📱 apre quella del telefono, ma accetta solo foto scattate negli ultimi 3 minuti (niente galleria).
- **Timer di recupero:** parte quando segni una serie. Con lo schermo spento Android può sospenderlo: per questo c'è l'opzione "Schermo sempre acceso" durante l'allenamento.
- **Backup:** Altro → Esporta crea un file con dati e foto. Salvalo su Google Drive; per recuperarlo usa Altro → Ripristina.
- **Aggiornamenti:** sostituisci i file su GitHub; l'app si aggiorna alla seconda apertura senza toccare i dati.
