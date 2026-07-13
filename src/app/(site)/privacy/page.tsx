import Link from "next/link";
import { PRIMARY_LANG } from "@/lib/l10n";
import { CONTENT } from "@/lib/siteContent";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="label-gold text-xs">Informativa</p>
        <h1 className="font-serif-display mt-2 text-3xl italic text-foreground">
          Informativa sulla privacy
        </h1>
        <p className="mt-2 text-sm text-foreground/60">Ultimo aggiornamento: giugno 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-foreground/80">
          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Titolare del trattamento</h2>
            <p className="mt-2">
              {CONTENT.hostName}, host di &ldquo;{CONTENT.siteTitle[PRIMARY_LANG] || CONTENT.siteTitle.it}&rdquo; — {CONTENT.city}.
              Per qualsiasi richiesta relativa ai tuoi dati personali puoi scrivere a{" "}
              <a href={`mailto:${CONTENT.email}`} className="text-gold underline">
                {CONTENT.email}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Quali dati raccogliamo</h2>
            <p className="mt-2">
              Quando invii una richiesta di prenotazione raccogliamo: nome, cognome, indirizzo
              email, numero di telefono, date di soggiorno, numero di ospiti ed eventuali
              messaggi che ci scrivi. In caso di pagamento online, registriamo il metodo di
              pagamento scelto e la data del pagamento — non i dati della carta, che non
              vengono mai raccolti né salvati da noi ma gestiti direttamente da Stripe.
            </p>
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Recensioni</h2>
            <p className="mt-2">
              Se scegli di lasciare una recensione, trattiamo il nome che indichi e il testo
              della recensione (che, con il tuo consenso esplicito, pubblichiamo sul sito e
              possono comparire nei risultati dei motori di ricerca), oltre — se le fornisci —
              a un&apos;email e a un codice di prenotazione, usati solo per verificare che il
              soggiorno sia reale e mai pubblicati. La base giuridica della pubblicazione è il
              tuo consenso: puoi revocarlo e chiederne la rimozione in qualsiasi momento
              scrivendo all&apos;indirizzo indicato sopra. Pubblichiamo solo recensioni di
              ospiti reali, dopo una verifica manuale, e non rimuoviamo quelle negative
              autentiche.
            </p>
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Perché li usiamo</h2>
            <p className="mt-2">
              Usiamo questi dati esclusivamente per gestire la tua richiesta di prenotazione:
              valutarla, comunicarti l&apos;esito, coordinare l&apos;arrivo e la partenza, ed
              inviarti le conferme relative al tuo soggiorno. Non li usiamo per finalità di
              marketing e non li vendiamo né condividiamo con terze parti, ad eccezione dei
              fornitori tecnici che ci permettono di operare il sito (hosting su Vercel,
              database su Neon, invio email tramite Resend), che trattano i dati per nostro
              conto secondo le rispettive policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">Quanto li conserviamo</h2>
            <p className="mt-2">
              Conserviamo i dati delle richieste di prenotazione per il tempo necessario a
              gestire il soggiorno e per gli obblighi fiscali/amministrativi previsti dalla
              legge italiana. Puoi richiederne la cancellazione in qualsiasi momento, salvo
              quanto debba essere conservato per obbligo di legge.
            </p>
          </section>

          <section>
            <h2 className="font-serif-display text-xl italic text-foreground">I tuoi diritti</h2>
            <p className="mt-2">
              In qualità di interessato hai diritto di accedere, rettificare o cancellare i
              tuoi dati, e di opporti o limitarne il trattamento, scrivendo all&apos;indirizzo
              indicato sopra.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-10 inline-block text-sm text-gold underline">
          ← Torna al sito
        </Link>
      </div>
    </div>
  );
}
