# Sõnarännak · Wordjourney

Rahulik sõnamäng Androidi telefonile ja veebibrauserile, eesti, vene ja inglise keeles. Versioonis 0.3.0 on 148 taset ning kolm mänguviisi: ristsõna, sõnajaht ja sõnaread.

Sõnarännak on nüüd iseseisev rakendus hoidlas `m2gn3tic-byte/wordjourney`. See avaneb otse avalehel. Varasemasse kohvrimängu hoidlasse tehtud Sõnarännaku osa on üle toodud; see projekt ei vaja selle hoidla faile ega sõltuvusi.

## Arendamine

Node.js 22+ ja npm. Pilvekeskkonnas kasuta olemasolevat checkout'i `/workspace/wordjourney`; uus Git worktree pole vajalik.

```sh
cd /workspace/wordjourney
npm ci
npm run dev
```

Ava terminalis näidatud arendusserveri avaleht. Tootmise versiooni jaoks käivita `npm run build` ja seejärel `npm run preview`. Mäng ei vaja andmebaasi, kontot ega API-võtit.

## Praegune versioon

- Kuus peatükki: Saaremaa, Rabavaikus, Vanalinn, Metsarajad, Meretuul ja Sõnameister. Need kasutavad kolme oma taustamaastikku.
- Lisatud on 100 uut mõistatust: kokku 84 eestikeelset, 32 venekeelset ja 32 ingliskeelset taset. Keeled hoiavad eraldi edenemist ja kasutavad ühist rahakotti. Seniste tasemete järjekord ja salvestusvõti `sonarannak-v1` säilivad.
- Ristsõnas ristuvad vastused; sõnajahis otsitakse sõnu ruudustikust sirgjooneliselt kõigis kaheksas suunas; sõnaridades täidetakse eraldi vastuseread. Kõiki mänguviise saab avalehelt ka tasuta harjutada. Harjutus ei anna münte ega ava rännaku tasemeid ning selle vihjed on tasuta.
- Telefonivaate alus on 9:16: 360 × 640 CSS-pikslit seadme pikslisuhtega 3 annab 1080 × 1920 pildi. Kogu mänguvaade kohandub tegeliku ekraani ja turvaalade järgi; olulised nupud jäävad mängu ajal nähtavale. Androidi rakendus kasutab püstsuunda.
- Tähtede ühendamine hiire või puutega, üksikute tähtede valimine ja klaviatuur. Enter kontrollib, Backspace eemaldab ning Escape tühjendab valiku. Täpitähed ja kirillitsa on eraldi tähed.
- Vihjed, lisasõnad, tasuta tähtede segamine ning vaiksed helid. Kõik tasemed saab läbida münte kulutamata.
- Päeva mõistatus valib kuupäeva järgi ühe olemasoleva taseme; see ei ole veel piiramatu eraldi päevatasemete generaator. Päev vahetub Europe/Tallinn ajavööndis. Varasemate päevade mõistatused säilitavad oma paigutuse.
- Alguses 120 münti, tase +20, lisasõna +5 ja päeva mõistatus +40. Tasu väljastatakse ühe korra vastava mõistatuse kohta. Vihje avab ühe tähe 25 mündi eest.
- Tasemed ja lisasõnad on käsitsi valitud väike sõnakogu. Kõiki kehtivaid sõnu mäng veel ei tunne; enne laiemat avaldamist vajavad sõnaloendid ka emakeelset toimetamist.

## Võrguühenduseta ja avakuvale lisamine

Tootmise versioon salvestab oma failid ja kõigi kolme peatüki pildid service worker'i vahemällu. Enne interneti väljalülitamist oota märki **„Võrguühenduseta mängimiseks valmis”**. Pärast seda saab mängu samal aadressil uuesti avada, edenemist jätkata ja proovipoodi kasutada ka võrguühenduseta. See vajab HTTPS-i või usaldatud kohalikku arendusmasinat; Vite arendusrežiim service worker'it ei käivita.

Toetatud brauseris saab mängu menüüst avakuvale lisada. Arvutivaates saab kasutada ka brauseri pakutavat paigaldusnuppu. Brauseri salvestusruumi piirangud ja vahemälu eemaldamine võivad võrguühenduseta valmisoleku tühistada. Androidi APK sisaldab kõiki veebifaile ja töötab kohe ilma arendusserveri või service worker'ita. Veebi ning APK edenemine ei sünkrooni omavahel.

## Telefonis proovimine ja Google Play

Prooviversiooni haru `playtest` sisaldab faili `sonarannak-debug.apk`, ühefaililist veebimängu ja omaniku allkirja ootavat AAB-d. [Prooviversiooni ZIP](https://github.com/m2gn3tic-byte/wordjourney/archive/refs/heads/playtest.zip) tuleb esmalt GitHubist alla laadida. Androidis ava APK ja luba vajaduse korral selle allika paigaldusõigus. See on arenduse prooviallkirjaga pakett, mitte Play poe väljalase.

Androidi tunnus on esialgu `ee.sonarannak.game`, versioon 0.3.0, versionCode 1. Vajalik on Android 7.0 / API 24 või uuem; compile/target SDK on 36. Kui rakendus on Play Console'is juba loodud, tuleb enne uut üleslaadimist kasutada selle olemasolevat tunnust ja järgmist versionCode'i.

```sh
npm run android:setup
npm run android:build
```

Seadistus kasutab täis-JDK-d 21, Android SDK Platform 36 ja Build Tools 36.0.0. Pilve asukohad on `/workspace/android-jdk`, `/workspace/android-sdk`, `/workspace/android-gradle` ja `/workspace/android-user`. Paigaldus säilitab TLS-i ja kontrollsummade kontrolli. JDK 21.0.13+9 arhiivi SHA-256 pärineb Adoptiumi ametlikust väljalaskest; Google'i käsureatööriistade arhiivi SHA-1 pärineb ametlikust SDK manifestist. Gradle 8.14.3 jaotuse SHA-256 on wrapperi konfiguratsioonis fikseeritud. Java kasutab päritud puhverserveri hosti/porti ning süsteemi usaldussertifikaate.

Ehitus loob `artifacts/sonarannak-debug.apk` ning `artifacts/sonarannak-unsigned.aab`, kontrollib APK allkirja ja käivitab Androidi lint-kontrolli. AAB on **allkirjastamata**: Play Console'i üleslaadimiseks vajab see omaniku upload-võtit ja sobivat väljalaske allkirja. Debug-võti selleks ei sobi. Hoia võtmed hoidlast väljas; loo ja varunda upload-võti Android Studio allkirjastamise viisardis või kasuta oma olemasolevat võtit. Play Console'i konto, poeleht, privaatsusteave ja vajalikud seadmetestid jäävad omaniku teha. Päris telefonis või emulaatoris käivitamist pole selle pilve ehituskatsetega kinnitatud.

Edenemine ja proovimündid säilivad ainult selle brauseri localStorage'is. Kui varasem mäng avanes samal päritolul ja selle andmed on alles, loeb uus versioon sama `sonarannak-v1` mänguseisu. Teise päritolu või seadme andmeid brauser automaatselt üle ei kanna. Brauseri andmete kustutamine eemaldab kohaliku edenemise. Kontot ega pilvesünkroonimist pole.

## Mündipood

Poes on 300, 900 ja 2400 mündi paketid. **Kõik ostud on tasuta näidisostud.** Kuvatavad eurohinnad on näidised. Ostu kinnitamine lisab ainult kohalikke proovimünte; loobumine ei muuda saldot. Tehingud salvestatakse tüübiga `demo`.

Päris makseid, makseandmete küsimist ega Google Play Billingut pole ühendatud. Kohalik rahakott pole pärisostude jaoks usaldusväärne andmeallikas. Pärisostude järgmine etapp vajab Play Console'i rakendust, poetooteid, serveripoolset ostutõendite kontrolli ja tehingute korduva kinnitamise vältimist.

## Ehitamine ja kontrollid

```sh
npm test
npm run test:e2e
npm run build:standalone
```

14 loogikatesti kontrollivad kõigi 148 mõistatuse lahendatavust, eri mängulaudade kuju, sõnajahi päris koordinaate, preemiaid, tasuta harjutusi, vihjeid ja varasema mänguseisu jätkamist. 34 brauseritesti kasutavad arvuti-, telefoni- ning täpset 1080 × 1920 vaadet ja kontrollivad ka puutega lohistamist, keeli, peatükkide avamist, näidisoste, salvestusvigu, tootmise alamteed ning võrguühenduseta uuesti laadimist. Pilves valitakse `/usr/bin/chromium`; mujal saad määrata `CHROMIUM_PATH` või paigaldada brauseri käsuga `npx playwright install chromium`.

Testid käivitavad serverid portidel 5175, 4175 ja 4275. Ära käivita samal ajal sõltuvuste paigaldust ega teist ehitust samadesse väljundkataloogidesse.

`npm run build:standalone` loob `artifacts/Sonarannak.html`, mis sisaldab koodi, kujundust ja kõiki taustapilte. Kopeeri fail oma arvutisse ja ava brauseris; serverit ega võrku pole vaja. Faili suurus on umbes 11 MiB. Pilvemasina failitee üksi ei tähenda avalikku allalaadimislinki. Hallatud Chromium võib `file://` avamise blokeerida, mistõttu kontrollitakse automaatselt sama HTML-i isoleeritud päritolul, keelates kõik lisapäringud; päris seadmes avamine jääb eraldi kontrolliks.

`npm run build:pages` valmistab failid hoidla alamteele `/wordjourney/` kataloogis `dist-pages/`. See käsk **ei avalda** veebilehte ega muuda GitHubi harusid. Ka pilvekeskkonna avaldamine ei avalda mängu veebis ega Play poes.

Käsk `npm run publish:playtest` on eraldi avaldamistoiming: valmis ja kontrollitud väljundid saadetakse harudesse `gh-pages` ja `playtest`, lähtekoodi hetktõmmis harusse `sonarannak-v0.3`. Skript ei muuda `main` haru ega aktiivset checkout'i ning ei kasuta sundlükkamist. GitHub Pagesi seadetes tuleb valida **Deploy from a branch → gh-pages → /(root)**. Veebiaadress pärast aktiveerimist on `https://m2gn3tic-byte.github.io/wordjourney/`. Selle URL-i toimimist tuleb eraldi kontrollida; haru olemasolu ei tõenda veel veebilehe avaldamist.

Kujunduspildid asuvad `src/wordgame/assets/`. Muutes võrguühenduseta salvestatavate failide sisu, uuenda `public/sw.js` vahemäluversiooni ja kontrolli nii esmast laadimist kui ka offline-taaskäivitust.
