import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  ANNOTATION_LOCATOR_CLASS,
  TransientAnnotationLocator
} from "../src/companion/AnnotationLocator";

function target() {
  const classes = new Set<string>();
  return {
    classes,
    classList: {
      add(value: string) { classes.add(value); },
      remove(value: string) { classes.delete(value); }
    }
  };
}

test("keeps one transient annotation locator active at a time", () => {
  const callbacks: Array<() => void> = [];
  const cancelled: unknown[] = [];
  const locator = new TransientAnnotationLocator(
    (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    (handle) => cancelled.push(handle),
    10
  );
  const first = target();
  const second = target();

  locator.show(first);
  equal(first.classes.has(ANNOTATION_LOCATOR_CLASS), true);
  locator.show(second);
  equal(first.classes.has(ANNOTATION_LOCATOR_CLASS), false);
  equal(second.classes.has(ANNOTATION_LOCATOR_CLASS), true);
  deepEqual(cancelled, [1]);

  callbacks[1]();
  equal(second.classes.has(ANNOTATION_LOCATOR_CLASS), false);
});

test("clears cleanly on edit, file change or disposal", () => {
  const locator = new TransientAnnotationLocator(() => 1, () => {});
  const element = target();
  locator.show(element);
  locator.clear();
  equal(element.classes.size, 0);
  locator.show(element);
  locator.dispose();
  equal(element.classes.size, 0);
});
