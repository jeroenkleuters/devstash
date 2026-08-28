import { describe, expect, it } from "vitest";

import {
  sortFavoriteCollections,
  sortFavoriteItems,
} from "@/lib/favorites-sort";

function item(title: string, typeName: string, iso: string) {
  return { title, type: { name: typeName }, updatedAt: new Date(iso) };
}

function collection(name: string, iso: string) {
  return { name, updatedAt: new Date(iso) };
}

describe("sortFavoriteItems", () => {
  // Mixed case on purpose: a plain `<` orders every capital ahead of every
  // lowercase letter, so "apple" would fall behind "Banana".
  const items = [
    item("Banana", "Snippet", "2026-08-03T00:00:00Z"),
    item("apple", "Note", "2026-08-01T00:00:00Z"),
    item("cherry", "Snippet", "2026-08-02T00:00:00Z"),
  ];

  it("sorts by name ascending, case-insensitively", () => {
    expect(sortFavoriteItems(items, "name-asc").map((i) => i.title)).toEqual([
      "apple",
      "Banana",
      "cherry",
    ]);
  });

  it("sorts by name descending", () => {
    expect(sortFavoriteItems(items, "name-desc").map((i) => i.title)).toEqual([
      "cherry",
      "Banana",
      "apple",
    ]);
  });

  it("sorts by date, newest first", () => {
    expect(sortFavoriteItems(items, "date").map((i) => i.title)).toEqual([
      "Banana",
      "cherry",
      "apple",
    ]);
  });

  it("groups by type name and orders each group newest first", () => {
    // Deliberately not the name order: "zebra" leads because its type does.
    const mixed = [
      item("apple", "Snippet", "2026-08-01T00:00:00Z"),
      item("zebra", "Note", "2026-08-01T00:00:00Z"),
      item("mango", "Snippet", "2026-08-05T00:00:00Z"),
    ];

    expect(sortFavoriteItems(mixed, "type").map((i) => i.title)).toEqual([
      "zebra",
      "mango",
      "apple",
    ]);
  });

  it("keeps the input order for items sharing a name, in both directions", () => {
    const tied = [
      item("same", "Snippet", "2026-08-01T00:00:00Z"),
      item("SAME", "Note", "2026-08-02T00:00:00Z"),
    ];

    // Ties are not reversed by the descending sort: a stable sort only
    // reorders on a positive comparison, and equal names never produce one.
    expect(sortFavoriteItems(tied, "name-asc").map((i) => i.type.name)).toEqual([
      "Snippet",
      "Note",
    ]);
    expect(
      sortFavoriteItems(tied, "name-desc").map((i) => i.type.name),
    ).toEqual(["Snippet", "Note"]);
  });

  it("does not mutate the array it is given", () => {
    const original = [...items];

    sortFavoriteItems(items, "name-asc");

    expect(items).toEqual(original);
  });
});

describe("sortFavoriteCollections", () => {
  const collections = [
    collection("React Patterns", "2026-08-02T00:00:00Z"),
    collection("AI Workflows", "2026-08-03T00:00:00Z"),
    collection("devOps", "2026-08-01T00:00:00Z"),
  ];

  it("sorts by name ascending, case-insensitively", () => {
    expect(
      sortFavoriteCollections(collections, "name-asc").map((c) => c.name),
    ).toEqual(["AI Workflows", "devOps", "React Patterns"]);
  });

  it("sorts by name descending", () => {
    expect(
      sortFavoriteCollections(collections, "name-desc").map((c) => c.name),
    ).toEqual(["React Patterns", "devOps", "AI Workflows"]);
  });

  it("sorts by date, newest first", () => {
    expect(
      sortFavoriteCollections(collections, "date").map((c) => c.name),
    ).toEqual(["AI Workflows", "React Patterns", "devOps"]);
  });

  it("does not mutate the array it is given", () => {
    const original = [...collections];

    sortFavoriteCollections(collections, "date");

    expect(collections).toEqual(original);
  });
});
