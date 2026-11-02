export type Kayit = {
  id: string;
  ad: string;
  tc: string;
  plaka: string;
  pdfAd?: string | undefined;
  pdf?: Blob | undefined;
  olusturma: number;
};

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

export const tumKayitlar = () => tx<Kayit[]>("readonly", (s) => s.getAll());
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
    list.map(async (k) => ({ ...k, pdf: k.pdf ? await toB64(k.pdf) : undefined })),
  );
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

export async function yedekYukle(file: File) {
  const data = JSON.parse(await file.text()) as (Omit<Kayit, "pdf"> & { pdf?: string })[];
  for (const k of data) {
    const pdf = k.pdf ? await (await fetch(k.pdf)).blob() : undefined;
    await kaydet({ ...k, pdf });
  }
  return data.length;
}
