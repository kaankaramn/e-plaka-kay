export type Belge = { id: string; ad: string; blob: Blob };
export type Kayit = {
  id: string;
  ad: string;
  tc: string;
  plaka: string;
  pdfler: Belge[];
  olusturma: number;
};

type EskiKayit = Partial<Kayit> & { pdf?: Blob; pdfAd?: string };

const DB = "sigorta-kayitlari";
const STORE = "kayitlar";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}

function normalize(k: EskiKayit): Kayit {
  const pdfler = k.pdfler ?? (k.pdf ? [{ id: crypto.randomUUID(), ad: k.pdfAd ?? "belge.pdf", blob: k.pdf }] : []);
  return { id: k.id!, ad: k.ad ?? "", tc: k.tc ?? "", plaka: k.plaka ?? "", olusturma: k.olusturma ?? Date.now(), pdfler };
}

export const tumKayitlar = async () => (await tx<EskiKayit[]>("readonly", (s) => s.getAll())).map(normalize);
export const kaydet = (k: Kayit) => tx("readwrite", (s) => s.put(k));
export const sil = (id: string) => tx("readwrite", (s) => s.delete(id));

const toB64 = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

export async function yedekAl() {
  const list = await tumKayitlar();
  const out = await Promise.all(
    list.map(async (k) => ({
      ...k,
      pdfler: await Promise.all(k.pdfler.map(async (p) => ({ id: p.id, ad: p.ad, blob: await toB64(p.blob) }))),
    })),
  );
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

export async function yedekYukle(file: File) {
  type Y = { id: string; ad?: string; tc?: string; plaka?: string; olusturma?: number; pdfAd?: string; pdf?: string; pdfler?: { id: string; ad: string; blob: string }[] };
  const data = JSON.parse(await file.text()) as Y[];
  for (const k of data) {
    const toBlob = async (s: string) => (await fetch(s)).blob();
    const pdfler = k.pdfler
      ? await Promise.all(k.pdfler.map(async (p) => ({ ...p, blob: await toBlob(p.blob) })))
      : k.pdf
        ? [{ id: crypto.randomUUID(), ad: k.pdfAd ?? "belge.pdf", blob: await toBlob(k.pdf) }]
        : [];
    await kaydet(normalize({ id: k.id, ad: k.ad ?? "", tc: k.tc ?? "", plaka: k.plaka ?? "", olusturma: k.olusturma ?? Date.now(), pdfler }));
  }
  return data.length;
}

// ---- Giriş ----
const AUTH_KEY = "durakoglu-giris";
async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const hesapVar = () => !!localStorage.getItem(AUTH_KEY);
export async function hesapOlustur(kullanici: string, sifre: string) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ k: kullanici.trim(), h: await hash(sifre) }));
}
export async function girisKontrol(kullanici: string, sifre: string) {
  const v = JSON.parse(localStorage.getItem(AUTH_KEY) ?? "null");
  return !!v && v.k === kullanici.trim() && v.h === (await hash(sifre));
}
