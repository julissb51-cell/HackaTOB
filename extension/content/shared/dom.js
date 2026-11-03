(function () {
  "use strict";

  function queryAllDeep(selector, root) {
    const start = root || document;
    const out = [];
    const seenRoots = new Set();
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      if (!current || seenRoots.has(current) || !current.querySelectorAll) continue;
      seenRoots.add(current);
      for (const node of current.querySelectorAll(selector)) out.push(node);
      for (const node of current.querySelectorAll("*")) {
        if (node.shadowRoot) stack.push(node.shadowRoot);
      }
    }
    return out;
  }

  function queryDeep(selector, root) {
    return queryAllDeep(selector, root)[0] || null;
  }

  function isVisible(element) {
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 8) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    if (!style) return true;
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  }

  function findFirst(selectors, root) {
    for (const selector of selectors) {
      const found = queryAllDeep(selector, root);
      if (found.length) return found;
    }
    return [];
  }

  globalThis.EnlazaDom = {
    queryAllDeep,
    queryDeep,
    isVisible,
    findFirst,
  };
})();
