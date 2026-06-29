import { describe, it, expect } from "vitest";
import {
  normalizeToCatalogBase,
  groupItemsByService,
} from "@/lib/offerServiceType";

interface TestItem {
  id: string;
  service_type?: string | null;
  position?: number;
}

describe("normalizeToCatalogBase — base'ler (exact + variant)", () => {
  it("umzug", () => {
    expect(normalizeToCatalogBase("umzug")).toBe("umzug");
    expect(normalizeToCatalogBase("umzug_privat")).toBe("umzug");
    expect(normalizeToCatalogBase("privatumzug")).toBe("umzug");
    expect(normalizeToCatalogBase("umzug_buero")).toBe("umzug");
  });
  it("reinigung", () => {
    expect(normalizeToCatalogBase("endreinigung")).toBe("reinigung");
    expect(normalizeToCatalogBase("reinigung_fenster")).toBe("reinigung");
    expect(normalizeToCatalogBase("fensterreinigung")).toBe("reinigung");
  });
  it("lagerung (prefix)", () => {
    expect(normalizeToCatalogBase("lagerung")).toBe("lagerung");
    expect(normalizeToCatalogBase("lagerung_keller")).toBe("lagerung");
  });
});

describe("D1 — transport_moebel ÇELİŞKİ regresyonu (→ transport, umzug DEĞİL)", () => {
  it("transport_moebel → transport", () => {
    expect(normalizeToCatalogBase("transport_moebel")).toBe("transport");
  });
  it("moebel_transport → transport", () => {
    expect(normalizeToCatalogBase("moebel_transport")).toBe("transport");
  });
  it("generic transport_* → transport", () => {
    expect(normalizeToCatalogBase("transport_xyz")).toBe("transport");
    expect(normalizeToCatalogBase("usm_transport")).toBe("transport");
  });
});

describe("D2 — klavier → transport", () => {
  it("klaviertransport → transport", () => {
    expect(normalizeToCatalogBase("klaviertransport")).toBe("transport");
  });
  it("transport_klavier → transport", () => {
    expect(normalizeToCatalogBase("transport_klavier")).toBe("transport");
  });
  it("içerik kuralı: *klavier* → transport", () => {
    expect(normalizeToCatalogBase("spezial_klavier_lift")).toBe("transport");
  });
});

describe("D3 — moebellift → moebellift (ayrı base)", () => {
  it("moebellift → moebellift", () => {
    expect(normalizeToCatalogBase("moebellift")).toBe("moebellift");
  });
  it("moebellift_einzug → moebellift (prefix)", () => {
    expect(normalizeToCatalogBase("moebellift_einzug")).toBe("moebellift");
  });
});

describe("D4 — malerarbeit / renovation → null", () => {
  it("malerarbeit → null", () => {
    expect(normalizeToCatalogBase("malerarbeit")).toBeNull();
    expect(normalizeToCatalogBase("malerarbeit_innen")).toBeNull();
  });
  it("renovation → null", () => {
    expect(normalizeToCatalogBase("renovation")).toBeNull();
    expect(normalizeToCatalogBase("renovation_komplett")).toBeNull();
  });
});

describe("D6 — umlaut: entrümpelung / entruempelung → raeumung", () => {
  it("entrümpelung (ü) → raeumung", () => {
    expect(normalizeToCatalogBase("entrümpelung")).toBe("raeumung");
  });
  it("entruempelung (ue) → raeumung", () => {
    expect(normalizeToCatalogBase("entruempelung")).toBe("raeumung");
  });
});

describe("raeumung ≠ entsorgung (Lesson #3 — ayrı)", () => {
  it("raeumung_keller → raeumung", () => {
    expect(normalizeToCatalogBase("raeumung_keller")).toBe("raeumung");
  });
  it("entsorgung_moebel → entsorgung", () => {
    expect(normalizeToCatalogBase("entsorgung_moebel")).toBe("entsorgung");
  });
  it("ikisi farklı base", () => {
    expect(normalizeToCatalogBase("raeumung_keller")).not.toBe(
      normalizeToCatalogBase("entsorgung_moebel"),
    );
  });
});

describe("defensive + tanınmayan", () => {
  it("null / boş → null", () => {
    expect(normalizeToCatalogBase(null)).toBeNull();
    expect(normalizeToCatalogBase("")).toBeNull();
    expect(normalizeToCatalogBase("   ")).toBeNull();
  });
  it("trim + lowercase", () => {
    expect(normalizeToCatalogBase("  UMZUG_Privat ")).toBe("umzug");
    expect(normalizeToCatalogBase("EndReinigung")).toBe("reinigung");
  });
  it("tanınmayan → null", () => {
    expect(normalizeToCatalogBase("xyz")).toBeNull();
    expect(normalizeToCatalogBase("foobar_service")).toBeNull();
  });
});

describe("groupItemsByService", () => {
  it("TEK GRUP: hepsi umzug → length 1 (backward-compat sinyali)", () => {
    const items: TestItem[] = [
      { id: "a", service_type: "umzug" },
      { id: "b", service_type: "umzug" },
    ];
    const g = groupItemsByService(items);
    expect(g).toHaveLength(1);
    expect(g[0].serviceType).toBe("umzug");
    expect(g[0].label).toBe("Umzug");
  });

  it("TEK GRUP: hepsi null → length 1, Allgemein", () => {
    const g = groupItemsByService<TestItem>([{ id: "a" }, { id: "b", service_type: null }]);
    expect(g).toHaveLength(1);
    expect(g[0].serviceType).toBeNull();
    expect(g[0].label).toBe("Allgemein");
  });

  it("ÇOK GRUP: SERVICE_ORDER sıralı, Allgemein EN SON", () => {
    // giriş sırası bilinçli karışık: transport, (null), reinigung, umzug
    const items: TestItem[] = [
      { id: "t", service_type: "transport" },
      { id: "x" }, // null → Allgemein
      { id: "r", service_type: "reinigung" },
      { id: "u", service_type: "umzug" },
    ];
    const keys = groupItemsByService(items).map((g) => g.serviceType);
    expect(keys).toEqual(["umzug", "reinigung", "transport", null]);
  });

  it("moebellift, umzug'dan HEMEN SONRA gelir (SERVICE_ORDER)", () => {
    const items: TestItem[] = [
      { id: "r", service_type: "reinigung" },
      { id: "m", service_type: "moebellift" },
      { id: "u", service_type: "umzug" },
    ];
    const keys = groupItemsByService(items).map((g) => g.serviceType);
    expect(keys).toEqual(["umzug", "moebellift", "reinigung"]);
  });

  it("position grup İÇİNDE korunuyor (3,1,2 → 1,2,3)", () => {
    const items: TestItem[] = [
      { id: "c", service_type: "umzug", position: 3 },
      { id: "a", service_type: "umzug", position: 1 },
      { id: "b", service_type: "umzug", position: 2 },
    ];
    const g = groupItemsByService(items);
    expect(g[0].items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("Lesson #2: reinigung vs reinigung_end → 2 AYRI grup (normalize ETMEZ)", () => {
    const items: TestItem[] = [
      { id: "a", service_type: "reinigung" },
      { id: "b", service_type: "reinigung_end" },
    ];
    const g = groupItemsByService(items);
    expect(g).toHaveLength(2);
    // reinigung (SERVICE_ORDER) önce, reinigung_end (bilinmeyen) sonra; raw label görünür
    expect(g[0].serviceType).toBe("reinigung");
    expect(g[1].serviceType).toBe("reinigung_end");
    expect(g[1].label).toBe("Reinigung_end");
  });

  it("null/'' service_type → Allgemein grubu", () => {
    const g = groupItemsByService<TestItem>([
      { id: "a", service_type: "" },
      { id: "b", service_type: "   " },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].serviceType).toBeNull();
    expect(g[0].label).toBe("Allgemein");
  });

  it("boş items → []", () => {
    expect(groupItemsByService<TestItem>([])).toEqual([]);
  });

  it("SERVICE_ORDER dışı bilinmeyen base → kendi grubu, raw label", () => {
    const g = groupItemsByService<TestItem>([{ id: "a", service_type: "xyz" }]);
    expect(g).toHaveLength(1);
    expect(g[0].serviceType).toBe("xyz");
    expect(g[0].label).toBe("Xyz");
  });

  it("trim+lowercase ile bucket (aynı base'in farklı yazımı tek grup)", () => {
    const g = groupItemsByService<TestItem>([
      { id: "a", service_type: "Umzug" },
      { id: "b", service_type: " umzug " },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].serviceType).toBe("umzug");
  });
});

describe("SERVICE_OPTIONS (per-item dropdown)", () => {
  it("8 öğe: 7 base SERVICE_ORDER sırasında + allgemein son", async () => {
    const { SERVICE_OPTIONS } = await import("@/lib/offerServiceType");
    expect(SERVICE_OPTIONS.map((o) => o.value)).toEqual([
      "umzug", "moebellift", "reinigung", "raeumung", "entsorgung", "transport", "lagerung", "allgemein",
    ]);
  });
  it("label'lar LABEL_MAP'ten + Allgemein", async () => {
    const { SERVICE_OPTIONS } = await import("@/lib/offerServiceType");
    expect(SERVICE_OPTIONS.find((o) => o.value === "umzug")?.label).toBe("Umzug");
    expect(SERVICE_OPTIONS.find((o) => o.value === "moebellift")?.label).toBe("Möbellift");
    expect(SERVICE_OPTIONS.find((o) => o.value === "raeumung")?.label).toBe("Räumung");
    expect(SERVICE_OPTIONS.find((o) => o.value === "allgemein")?.label).toBe("Allgemein");
  });
});
