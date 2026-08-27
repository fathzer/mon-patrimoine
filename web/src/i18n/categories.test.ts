import { describe, it, expect } from "bun:test";
import { CategoryValues } from "../core/Categories.js";
import { fr } from "./fr.js";

describe("i18n category labels", () => {
  for (const category of CategoryValues) {
    it(`should have a French label for category "${category}"`, () => {
      expect(fr.categories[category]).toBeDefined();
      expect(typeof fr.categories[category]).toBe("string");
      expect(fr.categories[category].length).toBeGreaterThan(0);
    });
  }
});
