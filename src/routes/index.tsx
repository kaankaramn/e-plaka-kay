import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { kaydet, sil, tumKayitlar, yedekAl, yedekYukle, type Kayit } from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Poliçe Arşivi — Sigorta Müşteri Kayıtları" },
      { name: "description", content: "Bilgisayarınızda çalışan, çevrimdışı sigorta müşteri kayıt ve PDF arşivi." },
      { property: "og:title", content: "Poliçe Arşivi — Sigorta Müşteri Kayıtları" },
      { property: "og:description", content: "İsim, TC, plaka ve PDF belgeleriyle yerel müşteri veritabanı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const bos = { ad: "", tc: "", plaka: "" };
const trUp = (s: string) => s.toLocaleUpperCase("tr-TR");

function Index() {
  const [list, setList] = useState<Kayit[]>([]);
  const [form, setForm] = useState(bos);
  const [pdf, setPdf] = useState<File | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ ad: "", tc: "", plaka: "", pdf: "hepsi" });
  const [hata, setHata] = useState("");
  const [bilgi, setBilgi] = useState("");
  const pdfRef = useRef<HTMLInputElement>(null);
  const yedekRef = useRef<HTMLInputElement>(null);

  const yenile = () => tumKayitlar().then((l) => setList(l.sort((a, b) => b.olusturma - a.olusturma)));
  useEffect(() => {
    yenile();
  }, []);

  const filtreli = useMemo(
    () =>
      list.filter(
        (k) =>
          trUp(k.ad).includes(trUp(f.ad)) &&
          k.tc.includes(f.tc) &&
          trUp(k.plaka).replace(/\s/g, "").includes(trUp(f.plaka).replace(/\s/g, "")) &&
          (f.pdf === "hepsi" || (f.pdf === "var" ? !!k.pdf : !k.pdf)),
      ),
    [list, f],
  );

  const flash = (m: string) => {
    setBilgi(m);
    setTimeout(() => setBilgi(""), 2500);
  };

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ad.trim()) return setHata("İsim gerekli.");
    if (!/^\d{11}$/.test(form.tc)) return setHata("TC Kimlik No 11 haneli olmalı.");
    if (!form.plaka.trim()) return setHata("Plaka gerekli.");
    setHata("");
    const eski = editId ? list.find((k) => k.id === editId) : undefined;
    await kaydet({
      id: editId ?? crypto.randomUUID(),
      ad: form.ad.trim(),
      tc: form.tc,
      plaka: trUp(form.plaka.trim()),
      pdf: pdf ?? eski?.pdf,
      pdfAd: pdf?.name ?? eski?.pdfAd,
      olusturma: eski?.olusturma ?? Date.now(),
    });
    flash(editId ? "Kayıt güncellendi" : "Kayıt eklendi");
    temizle();
    yenile();
  }

  function temizle() {
    setForm(bos);
    setPdf(null);
    setEditId(null);
    setHata("");
    if (pdfRef.current) pdfRef.current.value = "";
  }

  function duzenle(k: Kayit) {
    setEditId(k.id);
    setForm({ ad: k.ad, tc: k.tc, plaka: k.plaka });
    setPdf(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pdfAc = (k: Kayit) => k.pdf && window.open(URL.createObjectURL(k.pdf), "_blank");

  async function yedekIndir() {
    const b = await yedekAl();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `sigorta-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-hero">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div>
            <p className="text-xs tracking-[0.35em] text-primary uppercase">Yerel Arşiv</p>
            <h1 className="font-display text-4xl text-foreground">Poliçe Arşivi</h1>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={yedekIndir}>Yedek Al</button>
            <button className="btn-ghost" onClick={() => yedekRef.current?.click()}>Yedek Yükle</button>
            <input
              ref={yedekRef}
              type="file"
              accept=".json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const n = await yedekYukle(file);
                flash(`${n} kayıt yüklendi`);
                yenile();
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[380px_1fr]">
        <form onSubmit={gonder} className="panel h-fit space-y-5 p-7 lg:sticky lg:top-6">
          <h2 className="font-display text-2xl">{editId ? "Kaydı Düzenle" : "Yeni Kayıt"}</h2>
          <Alan label="Ad Soyad">
            <input className="field" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          </Alan>
          <Alan label="TC Kimlik No">
            <input
              className="field font-mono"
              inputMode="numeric"
              maxLength={11}
              value={form.tc}
              onChange={(e) => setForm({ ...form, tc: e.target.value.replace(/\D/g, "") })}
            />
          </Alan>
          <Alan label="Plaka">
            <input
              className="field font-mono uppercase"
              placeholder="34 ABC 123"
              value={form.plaka}
              onChange={(e) => setForm({ ...form, plaka: e.target.value })}
            />
          </Alan>
          <Alan label="PDF Belge">
            <label className="dropzone">
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
              {pdf
                ? pdf.name
                : editId && list.find((k) => k.id === editId)?.pdfAd
                  ? `Mevcut: ${list.find((k) => k.id === editId)?.pdfAd}`
                  : "PDF seçmek için tıklayın"}
            </label>
          </Alan>
          {hata && <p className="text-sm text-destructive">{hata}</p>}
          <div className="flex gap-2">
            <button className="btn-gold flex-1" type="submit">{editId ? "Güncelle" : "Kaydet"}</button>
            {editId && <button type="button" className="btn-ghost" onClick={temizle}>İptal</button>}
          </div>
        </form>

        <section className="space-y-5">
          <div className="panel grid gap-3 p-5 sm:grid-cols-4">
            <input className="field" placeholder="İsme göre filtrele" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
            <input className="field font-mono" placeholder="TC'ye göre" value={f.tc} onChange={(e) => setF({ ...f, tc: e.target.value.replace(/\D/g, "") })} />
            <input className="field font-mono" placeholder="Plakaya göre" value={f.plaka} onChange={(e) => setF({ ...f, plaka: e.target.value })} />
            <select className="field" value={f.pdf} onChange={(e) => setF({ ...f, pdf: e.target.value })}>
              <option value="hepsi">PDF: Hepsi</option>
              <option value="var">PDF var</option>
              <option value="yok">PDF yok</option>
            </select>
          </div>

          <p className="text-sm text-muted-foreground">
            {filtreli.length} / {list.length} kayıt gösteriliyor
          </p>

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-widest text-muted-foreground uppercase">
                  <th className="p-4">Ad Soyad</th>
                  <th className="p-4">TC</th>
                  <th className="p-4">Plaka</th>
                  <th className="p-4">Belge</th>
                  <th className="p-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtreli.map((k) => (
                  <tr key={k.id} className="border-t border-border/60 transition-colors hover:bg-accent/40">
                    <td className="p-4 font-medium">{k.ad}</td>
                    <td className="p-4 font-mono">{k.tc}</td>
                    <td className="p-4"><span className="plate">{k.plaka}</span></td>
                    <td className="p-4">
                      {k.pdf ? (
                        <button className="text-primary hover:underline" onClick={() => pdfAc(k)}>
                          {k.pdfAd ?? "PDF"}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="space-x-3 p-4 text-right whitespace-nowrap">
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => duzenle(k)}>Düzenle</button>
                      <button
                        className="text-destructive hover:underline"
                        onClick={async () => {
                          if (confirm(`${k.ad} kaydı silinsin mi?`)) {
                            await sil(k.id);
                            yenile();
                          }
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {filtreli.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      {list.length ? "Filtreye uyan kayıt yok." : "Henüz kayıt yok. Soldan ilk kaydı ekleyin."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {bilgi && <div className="toast">{bilgi}</div>}
    </div>
  );
}

function Alan({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs tracking-widest text-muted-foreground uppercase">{label}</span>
      {children}
    </label>
  );
}
